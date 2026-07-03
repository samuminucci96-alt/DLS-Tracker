import urllib.request, urllib.parse, json
key = '9a82bc8f-9576-4b21-b4a7-433203973a5e'
headers = {'X-Api-Key': key, 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'}
q = 'name:*ninetales* number:199* set.id:sv3'
url = 'https://api.pokemontcg.io/v2/cards?q=' + urllib.parse.quote(q) + '&pageSize=1'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.loads(r.read().decode())
    card = data['data'][0]
    print('keys:', list(card.keys()))
    print('lang:', card.get('language'))
    if 'set' in card:
        print('set keys:', list(card['set'].keys()))
    print('cardmarket keys:', list(card.get('cardmarket', {}).keys()))
    print('tcgplayer keys:', list(card.get('tcgplayer', {}).keys()))
    print('sample snippet:', json.dumps({k:card[k] for k in ['id','name','number','set','language','cardmarket','tcgplayer'] if k in card}, indent=2))
