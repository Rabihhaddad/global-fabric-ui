import requests
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def fetch_peeringdb(endpoint):
    print(f"📡 Downloading global {endpoint} table from PeeringDB...")
    response = requests.get(f"https://www.peeringdb.com/api/{endpoint}?limit=0")
    response.raise_for_status()
    return response.json()['data']

def sync_global_fabric():
    print("🌍 INITIATING GLOBAL SYNCHRONIZATION 2.0...")

    # 1. Download Core Datasets (Now including IXPs)
    facilities = fetch_peeringdb('fac')
    networks = fetch_peeringdb('net')
    netfacs = fetch_peeringdb('netfac')
    ixs = fetch_peeringdb('ix')
    ixfacs = fetch_peeringdb('ixfac')

    print("🧠 Stitching relational data in memory...")
    
    # Mappings
    net_dict = {n['id']: n['name'] for n in networks}
    ix_dict = {ix['id']: ix['name'] for ix in ixs}
    
    fac_to_nets = {}
    for nf in netfacs:
        fac_id = nf['fac_id']
        net_name = net_dict.get(nf['net_id'], "Unknown")
        if fac_id not in fac_to_nets: fac_to_nets[fac_id] = []
        fac_to_nets[fac_id].append(net_name)

    fac_to_ixs = {}
    for ixf in ixfacs:
        fac_id = ixf['fac_id']
        ix_name = ix_dict.get(ixf['ix_id'], "Unknown")
        if fac_id not in fac_to_ixs: fac_to_ixs[fac_id] = []
        fac_to_ixs[fac_id].append(ix_name)

    print(f"📦 Formatting {len(facilities)} facilities for AWS...")
    
    cloud_keywords = ['AWS', 'Amazon', 'Google', 'Azure', 'Microsoft', 'Oracle', 'Alibaba', 'IBM']
    items_to_write = []
    
    for fac in facilities:
        lat, lon, country = fac.get('latitude'), fac.get('longitude'), fac.get('country')
        if not lat or not lon or not country: continue
            
        fac_id = fac['id']
        all_nets = fac_to_nets.get(fac_id, [])
        all_ixs = list(set(fac_to_ixs.get(fac_id, []))) # Deduplicate IXs per facility
        
        clouds = [n for n in all_nets if any(k.lower() in n.lower() for k in cloud_keywords)]
        isps = [n for n in all_nets if n not in clouds]

        item = {
            'PK': f"COUNTRY#{country.upper()}",
            'SK': f"STATE#{(fac.get('state') or 'UNKNOWN').upper()}#FAC#{fac_id}",
            'FacID': fac_id,
            'Operator': fac.get('org_name', 'Unknown Operator'),
            'FacilityName': fac.get('name', 'Unknown Facility'),
            'Address': fac.get('address1', 'Unknown'),
            'Coordinates': {
                'Lat': Decimal(str(lat)),
                'Lon': Decimal(str(lon))
            },
            'Clouds': clouds,
            'ISPs': isps,
            'IXPs': all_ixs
        }
        items_to_write.append(item)

    print(f"🚀 Pushing {len(items_to_write)} enriched records to DynamoDB...")
    
    with table.batch_writer() as batch:
        for i, item in enumerate(items_to_write):
            batch.put_item(Item=item)
            if i % 500 == 0 and i > 0: print(f"  ...Uploaded {i} records...")

    print("✅ GLOBAL FABRIC SYNC COMPLETE!")

if __name__ == '__main__':
    sync_global_fabric()
