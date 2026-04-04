import boto3
import requests
import time
from boto3.dynamodb.conditions import Attr

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def get_network_names(fac_id):
    """Queries PeeringDB for all networks at a specific facility ID"""
    try:
        # API call to find networks at this facility
        url = f"https://www.peeringdb.com/api/netfac?fac_id={fac_id}"
        response = requests.get(url, timeout=10)
        data = response.json().get('data', [])
        
        # Extract the names of the networks
        networks = [n.get('local_name', n.get('name', 'Unknown')) for n in data]
        return list(set(networks)) # Remove duplicates
    except Exception as e:
        print(f"  ⚠️ PeeringDB lookup failed for Fac {fac_id}: {e}")
        return []

def global_enrichment():
    print("🌍 Starting Global Network Enrichment...")
    
    # 1. Scan DynamoDB for all facilities (we need the FacID from PeeringDB)
    # Note: We filter for items that have a 'FacID' stored
    response = table.scan()
    items = response.get('Items', [])
    
    print(f"📊 Processing {len(items)} facilities...")
    
    for i, item in enumerate(items):
        fac_id = item.get('FacID')
        if not fac_id:
            continue
            
        print(f"[{i+1}/{len(items)}] Enriching {item.get('FacilityName', 'Unknown')} (ID: {fac_id})...")
        
        # 2. Get the real-time list from PeeringDB
        all_networks = get_network_names(fac_id)
        
        # 3. Categorize them (Simple heuristic for the demo)
        clouds = [n for n in all_networks if any(x in n.upper() for x in ['AWS', 'AMAZON', 'GOOGLE', 'AZURE', 'MICROSOFT', 'ORACLE', 'CLOUD', 'ALIBABA'])]
        isps = [n for n in all_networks if n not in clouds]

        # 4. Update DynamoDB
        table.update_item(
            Key={'PK': item['PK'], 'SK': item['SK']},
            UpdateExpression="SET Clouds = :c, ISPs = :i, LastUpdated = :t",
            ExpressionAttributeValues={
                ':c': clouds,
                ':i': isps,
                ':t': int(time.time())
            }
        )
        
        # 5. RATE LIMIT PROTECTION: 
        # PeeringDB is free but strict. We wait 0.5s between calls.
        time.sleep(0.5)

    print("✅ Global Enrichment Complete!")

if __name__ == '__main__':
    global_enrichment()
