import requests
import boto3
from decimal import Decimal

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def fetch_peeringdb(endpoint):
    """Fetches the entire dataset from a PeeringDB table in one shot."""
    print(f"📡 Downloading global {endpoint} table from PeeringDB...")
    # limit=0 is a PeeringDB trick to dump the whole table at once
    response = requests.get(f"https://www.peeringdb.com/api/{endpoint}?limit=0")
    response.raise_for_status()
    return response.json()['data']

def sync_global_fabric():
    print("🌍 INITIATING GLOBAL SYNCHRONIZATION...")

    # 1. Download the Core Datasets
    facilities = fetch_peeringdb('fac')
    networks = fetch_peeringdb('net')
    netfacs = fetch_peeringdb('netfac')

    # 2. Build In-Memory Lookups (O(1) Speed)
    print("🧠 Stitching relational data in memory...")
    
    # Map Network ID -> Network Name (e.g., 174 -> Cogent)
    net_dict = {n['id']: n['name'] for n in networks}
    
    # Map Facility ID -> List of Network Names
    fac_to_nets = {}
    for nf in netfacs:
        fac_id = nf['fac_id']
        net_id = nf['net_id']
        net_name = net_dict.get(net_id, "Unknown")
        
        if fac_id not in fac_to_nets:
            fac_to_nets[fac_id] = []
        fac_to_nets[fac_id].append(net_name)

    # 3. Format the data for AWS DynamoDB
    print(f"📦 Formatting {len(facilities)} facilities for AWS...")
    
    # Simple heuristic to identify major cloud ramps
    cloud_keywords = ['AWS', 'Amazon', 'Google', 'Azure', 'Microsoft', 'Oracle', 'Alibaba', 'IBM']
    items_to_write = []
    
    for fac in facilities:
        lat = fac.get('latitude')
        lon = fac.get('longitude')
        country = fac.get('country')
        state = fac.get('state') or 'UNKNOWN'
        
        # Skip facilities with missing coordinate data
        if not lat or not lon or not country:
            continue
            
        fac_id = fac['id']
        all_nets = fac_to_nets.get(fac_id, [])
        
        # Sort into Clouds and ISPs
        clouds = [n for n in all_nets if any(k.lower() in n.lower() for k in cloud_keywords)]
        isps = [n for n in all_nets if n not in clouds]

        # Boto3 requires decimals, not floats, for DynamoDB coordinates
        item = {
            'PK': f"COUNTRY#{country.upper()}",
            'SK': f"STATE#{state.upper()}#FAC#{fac_id}",
            'FacID': fac_id,
            'Operator': fac.get('org_name', 'Unknown Operator'),
            'FacilityName': fac.get('name', 'Unknown Facility'),
            'Address': fac.get('address1', 'Unknown'),
            'Coordinates': {
                'Lat': Decimal(str(lat)),
                'Lon': Decimal(str(lon))
            },
            'Clouds': clouds,
            'ISPs': isps
        }
        items_to_write.append(item)

    # 4. Blast the data to AWS using Batch Writer
    print(f"🚀 Pushing {len(items_to_write)} enriched records to DynamoDB...")
    
    # batch_writer automatically chunks requests into groups of 25 to avoid overwhelming AWS
    with table.batch_writer() as batch:
        for i, item in enumerate(items_to_write):
            batch.put_item(Item=item)
            if i % 500 == 0 and i > 0:
                print(f"  ...Uploaded {i} records...")

    print("✅ GLOBAL FABRIC SYNC COMPLETE!")

if __name__ == '__main__':
    sync_global_fabric()
