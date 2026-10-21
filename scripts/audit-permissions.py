"""Compare le catalogue frontend aux annotations REST du backend, sans modifier le backend."""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend', type=Path, required=True)
parser.add_argument('--write', action='store_true', help='Actualiser le catalogue et le mapping des endpoints')
args = parser.parse_args()
root = args.backend / 'src/main/java'
rows = []
for source in sorted(root.rglob('*Controller.java')):
    text = source.read_text()
    if '@RestController' not in text:
        continue
    prefix = text.split('public class')[0]
    base = re.search(r'@RequestMapping\("([^"]*)"\)', prefix)
    base = base[1] if base else ''
    constants = dict(re.findall(r'(?:static final String)\s+(\w+)\s*=\s*"([^"]*)"', text))
    previous = text.find('public class')
    for match in re.finditer(r'\n\s*public (?!class\b)', text):
        block = text[previous:match.start()]
        previous = match.end()
        mapping = re.search(r'@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^\n]*)\))?', block)
        if not mapping:
            continue
        value = (mapping[2] or '').split(',')[0].removeprefix('value = ').strip()
        parts = re.findall(r'"([^"]*)"|(\b[A-Z][A-Z_]+\b)', value)
        path = base + ''.join(literal or constants[name] for literal, name in parts)
        expression = re.search(r'@PreAuthorize\(((?:"[^"]*"\s*\+?\s*)+)\)', block)
        expression = ''.join(re.findall(r'"([^"]*)"', expression[1])) if expression else 'PUBLIC'
        rows.append({'method': mapping[1].upper(), 'path': path.removeprefix('/api/v1'),
                     'expression': expression, 'controller': str(source.relative_to(root))})
assert rows and all(row['path'].startswith('/') for row in rows)
assert len({(r['method'], r['path']) for r in rows}) == len(rows), 'Endpoints en doublon'
entries = []
for row in rows:
    permissions = re.findall(r"hasAuthority\('(can_\w+)'\)", row['expression'])
    if not permissions:
        continue
    assert len(permissions) == 1 or '#request.' in row['expression'], 'Expression composée à traduire explicitement'
    entries.append(f"  [{json.dumps(row['method'])}, {json.dumps(row['path'])}, {json.dumps(permissions[0])}],")
catalog = """// Source : annotations @PreAuthorize des controllers Spring Boot.
// Actualisation : python3 scripts/audit-permissions.py --backend /chemin/backend --write
export const API_PERMISSIONS = [
""" + '\n'.join(entries) + "\n] as const;\n\nexport type BackendPermission = typeof API_PERMISSIONS[number][2]\n  | 'can_employee_assign_administrator' | 'can_payment_record' | 'can_timetable_delete';\n"
target = Path('src/app/core/api-permissions.ts')
if args.write:
    target.write_text(catalog)
    lines = ['# Mapping des endpoints et permissions backend', '',
             'Inventaire des controllers actifs, vérifié le 19 octobre 2026. Les annotations sont la référence ; les contrôles de licence, de périmètre et de propriété s’ajoutent à ces permissions.', '',
             '| HTTP | Endpoint (préfixe `/api/v1`) | Annotation | Controller |',
             '|---|---|---|---|']
    lines += [f"| {r['method']} | `{r['path']}` | `{r['expression']}` | `{r['controller']}` |" for r in rows]
    Path('docs/frontend-permission-endpoints.md').write_text('\n'.join(lines) + '\n')
else:
    assert target.read_text() == catalog, 'Le catalogue frontend diffère des annotations backend'
backend = {code for r in rows for code in re.findall(r'can_\w+', r['expression'])}
unknown = []
for source in Path('src/app').rglob('*'):
    if source.suffix not in ('.ts', '.html') or source.name.endswith('.spec.ts'):
        continue
    for code in set(re.findall(r'can_[a-z_]+', source.read_text())):
        if code.endswith('_') or code in backend:
            continue
        unknown.append(f'{source}: {code}')
print(f'{len(rows)} endpoints contrôlés ; {len(backend)} permissions backend ; {len(unknown)} référence(s) inconnue(s).')
if unknown:
    print('\n'.join(unknown))
    raise SystemExit(1)
