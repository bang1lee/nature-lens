"""Local adapter; imports Claude's reference core without changing its policy."""
import base64
import io
import json
import sys
import time
from pathlib import Path

research = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(research / 'refimpl'))
from lens import Lens
from PIL import Image

started = time.monotonic()
request = json.loads(sys.stdin.buffer.read(5_650_001))
model = Lens(research / '.models')
image = Image.open(io.BytesIO(base64.b64decode(request['jpeg'], validate=True)))
# No location supplied: use the reference vision-only path, never invent GPS.
branch = model.identify(image)
provenance = {'provider': 'local-inat-small', 'modelVersion': 'small-2',
              'policyVersion': 'reference-70-no-location-v1'}
result = {'state': 'abstain', 'reason': 'insufficient_evidence',
          'provenance': provenance, 'needsHumanReview': True}
ranks = {10: 'species', 20: 'genus', 30: 'family', 40: 'order', 50: 'class', 60: 'phylum'}
if branch:
    best = branch[-1]
    lineage = model.taxonomy.lineage(best.taxon_id)
    # Do not reinterpret animals as plants or non-insect animals as insects.
    target = 47126 if request['group'] == 'plant' else 47158
    if target not in lineage:
        result['reason'] = 'out_of_scope'
    elif best.rank_level in ranks:
        taxon = {'scientificName': best.name, 'koreanName': None,
                 'taxonId': f'inaturalist:{best.taxon_id}', 'rank': ranks[best.rank_level],
                 'score': max(0, min(1, best.score / 100)), 'scoreMeaning': 'uncalibrated'}
        result.pop('reason')
        if best.rank_level == 10:
            result.update(state='candidates', candidates=[taxon])
        else:
            result.update(state='ancestor', taxon=taxon)
print(json.dumps({'decision': result, 'metrics': {'elapsedMs': round((time.monotonic()-started)*1000),
      'externalRequests': 0, 'providerCostUsd': 0}}, allow_nan=False))
