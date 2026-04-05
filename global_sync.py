import requests
import boto3
from decimal import Decimal
import time

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def fetch(ep):
    # Added headers and retry logic to prevent 'KeyError'
    headers = {'User-Agent': 'GlobalFabricSync/2.0 (Contact: rob@packetrobasn.com)'}
    url = f"https://www.peeringdb.com/api/{ep}?limit=0"
    
    for attempt in range(3):
        try:
            print(f"📡 Pulling {ep} (Attempt {attempt + 1})...")
            response = requests.get(url, headers=headers, timeout=30)
            data = response.json()
            if 'data' in data:
                return data['data']
            else:
                print(f"⚠️ Unexpected response for {ep}: {data}")
        except Exception as e:
            print(f"❌ Error pulling {ep}: {e}")
        
        time.sleep(5) # Wait 5 seconds before retrying
    
    raise Exception(f"Failed to fetch {ep} after 3 attempts.")

def sync():
    # 1. Fetching all data with improved reliability
    try:
        facs = fetch('fac')
        nets = fetch('net')
        nfs = fetch('netfac')
        ixs = fetch('ix')
        ifs = fetch('ixfac')
    except Exception as e:
        print(f"⛔ Sync aborted: {e}")
        return

    print("🧠 Processing relationships...")
    net_map = {n['id']: n['name'] for n in nets}
    ix_map = {i['id']: i['name'] for i in ixs}
    
    f_nets, f_ixs = {}, {}
    for nf in nfs:
        f_id = nf['fac_id']
        name = net_map.get(nf['net_id'], "Unknown")
        f_nets.setdefault(f_id, []).append(name)
    for ifc in ifs:
        f_id = ifc['fac_id']
        name = ix_map.get(ifc['ix_id'], "Unknown")
        f_ixs.setdefault(f_id, []).append(name)

    # Expanded cloud list for better filtering
    cloud_keys = ['aws', 'amazon', 'google', 'azure', 'microsoft', 'oracle', 'alibaba', 'ibm', 'cloudflare', 'akamai', 'digitalocean']

    print(f"🚀 Pushing records to DynamoDB...")
    with table.batch_writer() as batch:
        for i, fac in enumerate(facs):
            fid = fac['id']
            lat, lon = fac.get('latitude'), fac.get('longitude')
            if not lat or not lon: continue

            all_n = list(set(f_nets.get(fid, [])))
            clouds = sorted([n for n in all_n if any(k in n.lower() for k in cloud_keys)])
            isps = sorted([n for n in all_n if n not in clouds])
            ixps = sorted(list(set(f_ixs.get(fid, []))))

            batch.put_item(Item={
                'PK': f"COUNTRY#{fac.get('country','XX').upper()}",
                'SK': f"FAC#{fid}",
                'Operator': fac.get('org_name', 'Unknown'),
                'FacilityName': fac.get('name', 'Unknown'),
                'Coordinates': {'Lat': Decimal(str(lat)), 'Lon': Decimal(str(lon))},
                'Clouds': clouds,
                'ISPs': isps,
                'IXPs': ixps
            })
            if i % 1000 == 0: print(f"  ✅ Progress: {i} nodes synced...")

    print("🏁 Final Sync Successful.")

if __name__ == '__main__':
    sync()
