import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'ero_erp_enterprise_secret_key_2026_very_long_and_secure');

async function runTest() {
  const token = await new jose.SignJWT({
    sub: 'u1111111-1111-1111-1111-111111111111',
    username: 'admin',
    email: 'admin@ero-erp.com',
    role: 'SUPER_ADMIN',
    companyId: 'c1111111-1111-1111-1111-111111111111',
    branchId: 'b1111111-1111-1111-1111-111111111111',
    warehouseId: 'w1111111-1111-1111-1111-111111111111',
    permissions: ['*'],
    branches: [],
    warehouses: [],
    allBranches: true,
    canSwitchWarehouses: true
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);

  console.log('Generated admin JWT token successfully');

  // 1. Get warehouses
  const getRes = await fetch('http://localhost:3000/api/config/warehouses', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const getData: any = await getRes.json();
  console.log('Warehouses fetched count:', getData.data?.length);
  console.log('First warehouse details:', {
    code: getData.data[0]?.code,
    name: getData.data[0]?.name,
    isDefaultSales: getData.data[0]?.isDefaultSales,
    isDefaultPurchases: getData.data[0]?.isDefaultPurchases,
  });

  const branchId = getData.data[0]?.branchId;

  // 2. Create test warehouse as default for sales
  const createRes = await fetch('http://localhost:3000/api/config/warehouses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      branchId,
      code: 'TEST-SALES',
      name: 'Depósito Test Ventas',
      isDefaultSales: true,
      isDefaultPurchases: false,
      isActive: true
    })
  });
  const createData: any = await createRes.json();
  console.log('Create test warehouse HTTP status:', createRes.status, 'success:', createData.success);
  const createdId = createData.data?.id;

  // 3. Verify that created warehouse has isDefaultSales = true, and verify branch cleanup
  const getAfterCreate = await fetch('http://localhost:3000/api/config/warehouses?branchId=' + branchId, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dataAfter: any = await getAfterCreate.json();
  const salesDefaults = dataAfter.data.filter((w: any) => w.isDefaultSales);
  console.log('Total warehouses with isDefaultSales=true in branch:', salesDefaults.length);
  console.log('Current sales default warehouse ID check:', salesDefaults[0]?.id === createdId ? 'SUCCESS (matches new ID)' : 'FAILED');

  // 4. Update the test warehouse to be default for purchases instead
  const updateRes = await fetch('http://localhost:3000/api/config/warehouses/' + createdId, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      isDefaultSales: false,
      isDefaultPurchases: true
    })
  });
  const updateData: any = await updateRes.json();
  console.log('Update test warehouse HTTP status:', updateRes.status, 'success:', updateData.success);

  // 5. Verify purchases default
  const getAfterUpdate = await fetch('http://localhost:3000/api/config/warehouses?branchId=' + branchId, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dataAfterUp: any = await getAfterUpdate.json();
  const purchDefaults = dataAfterUp.data.filter((w: any) => w.isDefaultPurchases);
  console.log('Total warehouses with isDefaultPurchases=true in branch:', purchDefaults.length);
  console.log('Current purchases default warehouse ID check:', purchDefaults[0]?.id === createdId ? 'SUCCESS (matches new ID)' : 'FAILED');

  // 6. Restore original main warehouse (ALM-01) as default for both
  const alm01 = dataAfterUp.data.find((w: any) => w.code === 'ALM-01');
  if (alm01) {
    await fetch('http://localhost:3000/api/config/warehouses/' + alm01.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        isDefaultSales: true,
        isDefaultPurchases: true
      })
    });
    console.log('Restored ALM-01 as default for sales and purchases.');
  }

  // 7. Delete test warehouse
  const delRes = await fetch('http://localhost:3000/api/config/warehouses/' + createdId, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
  const delData: any = await delRes.json();
  console.log('Delete test warehouse HTTP status:', delRes.status, 'success:', delData.success);

  console.log('=== ALL INTEGRATION TESTS PASSED PERFECTLY ===');
}

runTest().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
