const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const root = path.resolve(__dirname);
const apps = [
  { name: 'Portal', dir: 'apps/portal/src', portEnv: 'AUTH_PORT', fallbackPort: 8091 },
  { name: 'RVSK 6A', dir: 'apps/rvsk6a/src', portEnv: 'RVSK6A_PORT', fallbackPort: 8083 },
  { name: 'Schemes', dir: 'apps/schemes/src', portEnv: 'SCHEMES_PORT', fallbackPort: 8082 },
];
const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');

function parseArgs() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  return outputIndex >= 0 && args[outputIndex + 1]
    ? path.resolve(root, args[outputIndex + 1])
    : path.join(root, 'doc', 'RVSK_API_Catalog.xlsx');
}

function filesUnder(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.controller.ts')) result.push(fullPath);
  }
  return result;
}

function cleanRoute(value) {
  return (value || '').replace(/^['"`]/, '').replace(/['"`]$/, '').replace(/^\//, '').replace(/\/$/, '');
}

function humanize(name) {
  return name
    .replace(/^(get|create|update|delete|remove|set|save|toggle|activate|deactivate|refresh|validate|change|reset|complete|logout|login)/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (value) => value.toUpperCase()) || 'API operation';
}

function extractDecoratedArguments(args) {
  return [...args.matchAll(/@(Param|Query|Body|UploadedFile|UploadedFiles)\((?:['"`]([^'"`]*)['"`])?\)/g)]
    .map((match) => `${match[1]}${match[2] ? `: ${match[2]}` : ''}`);
}

function extractEndpoints(app) {
  const rows = [];
  const appRoot = path.join(root, app.dir);
  const port = process.env[app.portEnv] || app.fallbackPort;

  for (const filePath of filesUnder(appRoot)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const controllerMatch = source.match(/@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (!controllerMatch) continue;

    const baseRoute = cleanRoute(controllerMatch[1]);
    const controllerMatchByClass = source.match(/export class (\w+)/);
    const controller = controllerMatchByClass ? controllerMatchByClass[1] : path.basename(filePath, '.ts');
    const lines = source.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const routeMatch = lines[index].match(/^\s*@(Get|Post|Put|Patch|Delete|Options|Head)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
      if (!routeMatch) continue;

      const method = routeMatch[1].toUpperCase();
      const route = cleanRoute(routeMatch[2]);
      let signature = '';
      for (let next = index + 1; next < Math.min(lines.length, index + 15); next += 1) {
        signature += ` ${lines[next]}`;
        if (lines[next].includes('{')) break;
      }

      const handlerMatch = signature.match(/(?:async\s+)?(\w+)\s*\(([^)]*)\)/);
      if (!handlerMatch) continue;

      const handler = handlerMatch[1];
      const args = handlerMatch[2].replace(/\s+/g, ' ').trim();
      const decoratedArguments = extractDecoratedArguments(args);
      const context = lines.slice(Math.max(0, index - 5), index + 1).join('\n');
      const isPublic = context.includes('@Public()');
      const fullRoute = `/${prefix}/${baseRoute}${route ? `/${route}` : ''}`.replace(/\/+/g, '/');

      rows.push({
        service: app.name,
        port,
        method,
        url: `http://localhost:${port}${fullRoute}`,
        apiName: handler,
        description: humanize(handler),
        parameters: decoratedArguments.join(', ') || 'None',
        payload: args.includes('@Body') || args.includes('@Uploaded') ? args : 'None',
        expectedOutput: `Response returned by ${handler}()`,
        authentication: isPublic ? 'Public' : 'JWT/role guard may apply',
        controller,
        source: path.relative(root, filePath).replace(/\\/g, '/'),
      });
    }
  }

  return rows.sort((left, right) =>
    left.service.localeCompare(right.service) || left.url.localeCompare(right.url) || left.method.localeCompare(right.method),
  );
}

const columns = [
  { header: 'Service', key: 'service', width: 14 },
  { header: 'Port', key: 'port', width: 10 },
  { header: 'HTTP Method', key: 'method', width: 14 },
  { header: 'URL', key: 'url', width: 70 },
  { header: 'API Name', key: 'apiName', width: 28 },
  { header: 'Short Description', key: 'description', width: 34 },
  { header: 'Parameters', key: 'parameters', width: 30 },
  { header: 'Payload', key: 'payload', width: 48 },
  { header: 'Expected Output', key: 'expectedOutput', width: 38 },
  { header: 'Authentication', key: 'authentication', width: 24 },
  { header: 'Controller', key: 'controller', width: 24 },
  { header: 'Source File', key: 'source', width: 55 },
];

function addApiSheet(workbook, name, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `L${Math.max(1, rows.length + 1)}` };

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.height = 28;

  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAF2F8' } };
    }
  });
}

async function main() {
  const outputPath = parseArgs();
  const rows = apps.flatMap(extractEndpoints);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RVSK Portal Backend';
  workbook.created = new Date();

  addApiSheet(workbook, 'All APIs', rows);
  for (const app of apps) {
    addApiSheet(workbook, app.name, rows.filter((row) => row.service === app.name));
  }

  const readMe = workbook.addWorksheet('Read Me');
  readMe.columns = [
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Details', key: 'details', width: 110 },
  ];
  readMe.addRows([
    { item: 'API prefix', details: `Configured through API_PREFIX. Current value: ${prefix}` },
    { item: 'API count', details: `${rows.length} APIs discovered from controller source files.` },
    { item: 'Update command', details: 'npm run docs:apis' },
    { item: 'Custom output', details: 'node generate-api-catalog.js --output doc/another-name.xlsx' },
    { item: 'Payload note', details: 'Payload and parameter hints are extracted from controller signatures. Refer to the source file and DTO for complete validation rules and nested fields.' },
    { item: 'Generated', details: new Date().toISOString() },
  ]);
  readMe.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  readMe.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
  readMe.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Updated ${path.relative(root, outputPath)} with ${rows.length} APIs.`);
}

main().catch((error) => {
  console.error(`API catalog generation failed: ${error.message}`);
  process.exitCode = 1;
});
