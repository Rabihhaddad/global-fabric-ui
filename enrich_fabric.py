import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB connection
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('GlobalFabric')

def enrich_data():
    print("🔍 Scanning for Ashburn facilities to enrich...")
    
    # Target our Ashburn data specifically so we don't accidentally update the whole world
    response = table.query(
        KeyConditionExpression=Key('PK').eq('COUNTRY#US') & Key('SK').begins_with('STATE#VA')
    )
    facilities = response.get('Items', [])
    
    print(f"📦 Found {len(facilities)} facilities. Beginning enrichment injection...")
    
    updated_count = 0
    
    # Loop through every Ashburn facility
    for facility in facilities:
        operator = facility.get('Operator', '').upper()
        pk = facility['PK']
        sk = facility['SK']
        
        clouds = []
        isps = []
        
        # Determine the logical networks based on the building owner
        if 'EQUINIX' in operator:
            clouds = ['AWS Direct Connect', 'Azure ExpressRoute', 'Google Cloud Interconnect', 'Oracle FastConnect']
            isps = ['Cogent (ASN 174)', 'Lumen (ASN 3356)', 'Zayo (ASN 6461)', 'NTT (ASN 2914)']
        elif 'DIGITAL REALTY' in operator:
            clouds = ['AWS Direct Connect', 'IBM Cloud Direct Link', 'Oracle FastConnect']
            isps = ['Telia (ASN 1299)', 'GTT (ASN 3257)', 'Tata (ASN 6453)']
        elif 'CORESITE' in operator:
            clouds = ['AWS Direct Connect', 'Alibaba Cloud Express Connect']
            isps = ['Hurricane Electric (ASN 6939)', 'Verizon (ASN 701)']
        else:
            clouds = ['Megaport (Virtual)']
            isps = ['Comcast Business', 'AT&T Enterprise']
            
        # Execute the NoSQL Update
        try:
            table.update_item(
                Key={'PK': pk, 'SK': sk},
                UpdateExpression="SET Clouds = :c, ISPs = :i",
                ExpressionAttributeValues={
                    ':c': clouds,
                    ':i': isps
                }
            )
            updated_count += 1
        except Exception as e:
            print(f"❌ Failed to update {facility.get('FacilityName')}: {e}")

    print(f"✅ Successfully enriched {updated_count} facilities with Network and Cloud data!")

if __name__ == '__main__':
    enrich_data()
