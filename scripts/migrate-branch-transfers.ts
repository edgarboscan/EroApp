import { query } from '../apps/api/src/db';

async function migrateBranchTransfers() {
  console.log('🚀 Iniciando migración de campos de Tránsito y Transferencia entre Sucursales...');

  try {
    // 1. Columnas de Tránsito en inventory_transfers
    const transitColumns = [
      { name: 'carrier_name', def: 'VARCHAR(150) NULL' },
      { name: 'carrier_rif', def: 'VARCHAR(25) NULL' },
      { name: 'driver_name', def: 'VARCHAR(150) NULL' },
      { name: 'driver_id_document', def: 'VARCHAR(30) NULL' },
      { name: 'vehicle_plate', def: 'VARCHAR(30) NULL' },
      { name: 'vehicle_model', def: 'VARCHAR(100) NULL' },
      { name: 'security_seal_number', def: 'VARCHAR(100) NULL' },
      { name: 'shipping_guide_number', def: 'VARCHAR(50) NULL' },
      { name: 'estimated_arrival_at', def: 'DATETIME NULL' },
      { name: 'freight_cost', def: 'DECIMAL(14,4) NOT NULL DEFAULT 0.0000' },
      { name: 'transfer_type', def: "ENUM('INTERNAL_WAREHOUSE', 'BRANCH_TRANSFER') NOT NULL DEFAULT 'BRANCH_TRANSFER'" },
      { name: 'transfer_file_checksum', def: 'VARCHAR(64) NULL' },
      { name: 'transfer_file_exported_at', def: 'DATETIME NULL' },
      { name: 'email_sent_to', def: 'VARCHAR(150) NULL' },
      { name: 'email_sent_at', def: 'DATETIME NULL' },
    ];

    for (const col of transitColumns) {
      const checkCol: any = await query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_transfers' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (checkCol[0]?.count === 0) {
        console.log(`➕ Agregando columna ${col.name} a inventory_transfers...`);
        await query(`ALTER TABLE inventory_transfers ADD COLUMN ${col.name} ${col.def}`);
      }
    }

    // 2. Columnas en inventory_transfer_items
    const itemColumns = [
      { name: 'discrepancy_quantity', def: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
      { name: 'condition_status', def: "ENUM('OPTIMAL', 'DAMAGED', 'SHORTAGE', 'SURPLUS') NOT NULL DEFAULT 'OPTIMAL'" },
    ];

    for (const col of itemColumns) {
      const checkCol: any = await query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_transfer_items' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (checkCol[0]?.count === 0) {
        console.log(`➕ Agregando columna ${col.name} a inventory_transfer_items...`);
        await query(`ALTER TABLE inventory_transfer_items ADD COLUMN ${col.name} ${col.def}`);
      }
    }

    console.log('✅ Migración de Transferencias entre Sucursales completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración de transferencias:', err);
    process.exit(1);
  }
}

migrateBranchTransfers();
