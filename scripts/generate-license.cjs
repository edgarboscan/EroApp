#!/usr/bin/env node
/**
 * Generador & Emisor de Licencias Empresariales ERO ERP VE (Exclusivo Super Administrador)
 * Uso básico:
 *   node scripts/generate-license.cjs
 *
 * Opciones completas:
 *   node scripts/generate-license.cjs --rif "J-40123456-7" --company "DISTRIBUIDORA C.A." --fp "E6367596C53467B4C81E0B429033C646" --type "perpetua" --users 50 --branches 10 --support true
 */

const os = require('os');
const crypto = require('crypto');

function getHardwareFingerprint() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'GENERIC_CPU';
  const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const hostname = os.hostname();
  const platform = os.platform();

  const raw = `${cpuModel}|${totalMem}GB|${hostname}|${platform}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32).toUpperCase();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    rif: 'J-40123456-7',
    company: 'DISTRIBUIDORA Y COMERCIALIZADORA VENEZOLANA C.A.',
    fp: getHardwareFingerprint(),
    type: 'enterprise', // 'perpetua' | 'enterprise' | 'temporal' | 'trial'
    months: 12,
    users: 50,
    branches: 10,
    support: true,
    modules: [
      'dashboards',
      'pos',
      'inventory',
      'pricing',
      'purchases',
      'sales',
      'customers',
      'receivables',
      'suppliers',
      'payables',
      'treasury',
      'taxes',
      'reports',
      'config',
      'audit',
    ],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--rif' && args[i + 1]) options.rif = args[++i];
    else if (arg === '--company' && args[i + 1]) options.company = args[++i];
    else if (arg === '--fp' && args[i + 1]) options.fp = args[++i];
    else if (arg === '--type' && args[i + 1]) options.type = args[++i];
    else if (arg === '--months' && args[i + 1]) options.months = parseInt(args[++i], 10);
    else if (arg === '--users' && args[i + 1]) options.users = parseInt(args[++i], 10);
    else if (arg === '--branches' && args[i + 1]) options.branches = parseInt(args[++i], 10);
    else if (arg === '--support' && args[i + 1]) options.support = args[++i] === 'true';
    else if (arg === '--modules' && args[i + 1]) {
      const m = args[++i];
      if (m !== 'all') options.modules = m.split(',').map((s) => s.trim());
    } else if (!arg.startsWith('--') && i === 0) {
      options.fp = arg;
    }
  }

  return options;
}

const opts = parseArgs();
const cleanFp = opts.fp.trim().toUpperCase();
const prefix = opts.type === 'temporal' ? 'ERO-PRO' : 'ERO-ENTERPRISE';
const year = new Date().getFullYear();
const secret = process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure';

const hmac = crypto
  .createHmac('sha256', secret)
  .update(`${cleanFp}:${opts.type}:${year}`)
  .digest('hex')
  .toUpperCase();

const block1 = hmac.substring(0, 4);
const block2 = hmac.substring(4, 8);
const block3 = hmac.substring(8, 12);
const check = hmac.substring(12, 14);
const readableKey = `${prefix}-${year}-${block1}-${block2}-${block3}-${check}`;

let expiresAt = null;
if (opts.type === 'temporal' || opts.type === 'enterprise') {
  const exp = new Date();
  exp.setMonth(exp.getMonth() + (opts.months || 12));
  expiresAt = exp.toISOString();
} else if (opts.type === 'trial') {
  const exp = new Date();
  exp.setDate(exp.getDate() + 30);
  expiresAt = exp.toISOString();
}

const payload = {
  v: 1,
  fp: cleanFp,
  companyName: opts.company,
  companyRif: opts.rif,
  type: opts.type === 'enterprise' ? 'perpetua' : opts.type,
  expiresAt,
  maxUsers: opts.users,
  maxBranches: opts.branches,
  hasSupport: opts.support,
  modules: opts.modules,
  issuedAt: new Date().toISOString(),
  licenseKey: readableKey,
};

const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
const licensePackage = `ERO-PKG.${data}.${signature}`;

console.log('================================================================');
console.log('       EMISOR DE LICENCIAS ERO ERP - SUPER ADMINISTRADOR        ');
console.log('================================================================');
console.log(`Empresa / Razón Social : ${opts.company}`);
console.log(`RIF o Cédula           : ${opts.rif}`);
console.log(`Hardware Fingerprint   : ${cleanFp}`);
console.log(`Tipo de Licencia       : ${opts.type.toUpperCase()}`);
console.log(`Vigencia / Expiración  : ${expiresAt ? expiresAt.substring(0, 10) : 'PERPETUA (Sin caducidad)'}`);
console.log(`Usuarios Concurrentes  : ${opts.users} usuarios`);
console.log(`Sucursales Habilitadas : ${opts.branches} sucursales`);
console.log(`Soporte y Updates      : ${opts.support ? 'Garantizado (Incluido)' : 'No incluido'}`);
console.log(`Módulos Autorizados    : ${opts.modules.length} módulos (${opts.modules.join(', ')})`);
console.log('----------------------------------------------------------------');
console.log(`Clave de Activación    : ${readableKey}`);
console.log('----------------------------------------------------------------');
console.log('Paquete Firmado Criptográfico (Copiar para activación offline/on-premise):');
console.log(licensePackage);
console.log('================================================================');
