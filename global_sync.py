import requests
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def fetch_peeringdb(endpoint):
    print(f"📡 Downloading {endpoint}...")
    response = requests.get(f"https://www.peeringdb.com/api/{endpoint}?limit=0")
    response.raise_for_status()
    return response.json()['data']

def sync_global_fabric():
    print("🚀 STARTING FORCE SYNC...")
    
    # Get all the tables
    facs = fetch_peeringdb('fac')
    nets = fetch_peeringdb('net')
    netfacs = fetch_peeringdb('netfac')
    ixs = fetch_peeringdb('ix')
    ixfacs = fetch_peeringdb('ixfac')

    # Build Lookups
    net_lookup = {n['id']: n['name'] for n in nets}
    ix_lookup = {i['id']: i['name'] for i in ixs}
    
    # Map Facilities to Networks
    fac_to_nets = {}
    for nf in netfacs:
        f_id = nf['fac_id']
        name = net_lookup.get(nf['net_id'], "Unknown")
        if f_id not in fac_to_nets: fac_to_nets[f_id] = []
        fac_to_nets[f_id].append(name)

    # Map Facilities to IXPs
    fac_to_ixs = {}
    for ixf in ixfacs:
        f_id = ixf['fac_id']
        name = ix_lookup.get(ixf['ix_id'], "Unknown")
        if f_id not in fac_to_ixs: fac_to_ixs[f_id] = []
        fac_to_ixs[f_id].append(name)

    print(f"🔄 Processing {len(facs)} facilities...")
    cloud_keys = ['aws', 'amazon', 'google', 'azure', 'microsoft', 'oracle', 'alibaba', 'ibm']
    
    with table.batch_writer() as batch:
        for i, fac in enumerate(facs):
            f_id = fac['id']
            lat, lon = fac.get('latitude'), fac.get('longitude')
            if not lat or not lon: continue

            all_nets = fac_to_nets.get(f_id, [])
            # Deduplicate names and strip whitespace
            clouds = sorted(list(set([n for n in all_nets if any(k in n.lower() for k in cloud_keys)])))
            isps = sorted(list(set([n for n in all_nets if n not in clouds])))
            ixps = sorted(list(set(fac_to_ixs.get(f_id, []))))

            # This structure matches exactly what the frontend expects
            item = {
                'PK': f"COUNTRY#{fac.get('country', 'XX').upper()}",
                'SK': f"STATE#{(fac.get('state') or 'UNKNOWN').upper()}#FAC#{f_id}",
                'FacID': f_id,
                'Operator': fac.get('org_name', 'Unknown Operator'),
                'FacilityName': fac.get('name', 'Unknown Facility'),
                'Coordinates': {
                    'Lat': Decimal(str(lat)),
                    'Lon': Decimal(str(lon))
                },
                'Clouds': clouds,
                'ISPs': isps,
                'IXPs': ixps  # Ensure this matches the frontend variable name
            }
            batch.put_item(Item=item)
            
            if i % 1000 == 0:
                print(f"  ✅ Synced {i} records...")

    print("🏁 FORCE SYNC COMPLETE.")

if __name__ == '__main__':
    sync_global_fabric()
