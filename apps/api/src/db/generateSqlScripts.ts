import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ddlDir = path.resolve(__dirname, 'ddl');

function esc(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

interface ProductDef {
  sku: string;
  ean: string;
  name: string;
  desc: string;
  dept: number;
  grp: number;
  brand: string;
  unit: string;
  cost: number;
  price: number;
  sup: number;
  isExempt: boolean;
  stock1: number;
  stock2: number;
  aisle: string;
}

const products: ProductDef[] = [
  // VÍVERES BÁSICOS
  { sku: 'HAR-PAN-BLA', ean: '7591012300014', name: 'Harina P.A.N. Blanca 1 Kg', desc: 'Harina de maíz precocida blanca tradicional', dept: 0, grp: 0, brand: 'P.A.N.', unit: 'KG', cost: 1.05, price: 1.40, sup: 0, isExempt: true, stock1: 500, stock2: 120, aisle: 'Pasillo 1A' },
  { sku: 'HAR-PAN-AMA', ean: '7591012300021', name: 'Harina P.A.N. Amarilla 1 Kg', desc: 'Harina de maíz precocida amarilla', dept: 0, grp: 0, brand: 'P.A.N.', unit: 'KG', cost: 1.10, price: 1.45, sup: 0, isExempt: true, stock1: 300, stock2: 80, aisle: 'Pasillo 1A' },
  { sku: 'ARR-PRI-001', ean: '7591012300038', name: 'Arroz Primor Clásico Grano Entero 1 Kg', desc: 'Arroz blanco de primera seleccionado', dept: 0, grp: 1, brand: 'Primor', unit: 'KG', cost: 1.15, price: 1.55, sup: 0, isExempt: true, stock1: 450, stock2: 100, aisle: 'Pasillo 1B' },
  { sku: 'ARR-MAR-001', ean: '7591012300045', name: 'Arroz Mary Tradicional 1 Kg', desc: 'Arroz blanco enriquecido con hierro y vitaminas', dept: 0, grp: 1, brand: 'Mary', unit: 'KG', cost: 1.20, price: 1.60, sup: 0, isExempt: true, stock1: 400, stock2: 90, aisle: 'Pasillo 1B' },
  { sku: 'PAS-PRI-SPA', ean: '7591012300052', name: 'Pasta Primor Spaghetti 1 Kg', desc: 'Pasta larga de sémola de trigo durum', dept: 0, grp: 2, brand: 'Primor', unit: 'KG', cost: 1.30, price: 1.75, sup: 0, isExempt: true, stock1: 380, stock2: 110, aisle: 'Pasillo 1C' },
  { sku: 'PAS-RON-PLU', ean: '7591012300069', name: 'Pasta Ronco Corta Plumas 1 Kg', desc: 'Pasta corta tipo plumas para guisados', dept: 0, grp: 2, brand: 'Ronco', unit: 'KG', cost: 1.25, price: 1.70, sup: 10, isExempt: true, stock1: 320, stock2: 75, aisle: 'Pasillo 1C' },
  { sku: 'ACE-MAZ-LIT', ean: '7591012300076', name: 'Aceite Mazeite Puro de Maíz 1 Litro', desc: 'Aceite vegetal refinado comestible 100% puro maíz', dept: 0, grp: 3, brand: 'Mazeite', unit: 'LITRO', cost: 3.10, price: 4.10, sup: 0, isExempt: true, stock1: 250, stock2: 60, aisle: 'Pasillo 2A' },
  { sku: 'ACE-DIA-LIT', ean: '7591012300083', name: 'Aceite Comestible Diana 1 Litro', desc: 'Aceite vegetal comestible mezcla enriquecida', dept: 0, grp: 3, brand: 'Diana', unit: 'LITRO', cost: 2.20, price: 2.95, sup: 11, isExempt: true, stock1: 220, stock2: 50, aisle: 'Pasillo 2A' },
  { sku: 'AZU-MON-001', ean: '7591012300090', name: 'Azúcar Refinada Montalbán 1 Kg', desc: 'Azúcar refinada blanca de caña de azúcar', dept: 0, grp: 5, brand: 'Montalbán', unit: 'KG', cost: 1.10, price: 1.50, sup: 9, isExempt: true, stock1: 500, stock2: 150, aisle: 'Pasillo 2B' },
  { sku: 'GRA-CAR-NEG', ean: '7591012300106', name: 'Caraotas Negras Mary 500g', desc: 'Granos negros seleccionados cocción rápida', dept: 0, grp: 1, brand: 'Mary', unit: 'PAQ', cost: 1.35, price: 1.85, sup: 0, isExempt: true, stock1: 200, stock2: 60, aisle: 'Pasillo 2C' },
  { sku: 'GRA-LEN-LUC', ean: '7591012300113', name: 'Lentejas La Lucha 500g', desc: 'Lentejas de primera importadas', dept: 0, grp: 1, brand: 'La Lucha', unit: 'PAQ', cost: 1.40, price: 1.95, sup: 10, isExempt: true, stock1: 180, stock2: 45, aisle: 'Pasillo 2C' },
  { sku: 'CAF-FAM-250', ean: '7591012300120', name: 'Café Fama de América Tostado 250g', desc: 'Café molido gourmet venezolano aroma intenso', dept: 0, grp: 5, brand: 'Fama de América', unit: 'PAQ', cost: 2.40, price: 3.25, sup: 11, isExempt: true, stock1: 280, stock2: 70, aisle: 'Pasillo 3A' },
  { sku: 'ATU-MAR-ACE', ean: '7591012300137', name: 'Atún Margarita en Aceite 140g', desc: 'Lomo de atún aleta amarilla en aceite vegetal', dept: 0, grp: 4, brand: 'Primor', unit: 'UNID', cost: 1.45, price: 1.95, sup: 0, isExempt: true, stock1: 350, stock2: 90, aisle: 'Pasillo 3B' },
  { sku: 'SAR-GAV-170', ean: '7591012300144', name: 'Sardinas en Aceite La Gaviota 170g', desc: 'Sardinas enteras en aceite vegetal', dept: 0, grp: 4, brand: 'Primor', unit: 'UNID', cost: 0.65, price: 0.95, sup: 0, isExempt: true, stock1: 400, stock2: 120, aisle: 'Pasillo 3B' },

  // GRAVADOS: SALSAS Y DULCES
  { sku: 'MAY-MAV-445', ean: '7591012300151', name: 'Mayonesa Mavesa Frasco 445g', desc: 'Mayonesa tradicional cremosa', dept: 0, grp: 7, brand: 'Mavesa', unit: 'UNID', cost: 2.60, price: 3.65, sup: 0, isExempt: false, stock1: 260, stock2: 65, aisle: 'Pasillo 3C' },
  { sku: 'MAR-MAV-500', ean: '7591012300168', name: 'Margarina Mavesa con Sal 500g', desc: 'Margarina untable con sal', dept: 0, grp: 7, brand: 'Mavesa', unit: 'UNID', cost: 1.95, price: 2.75, sup: 0, isExempt: false, stock1: 300, stock2: 80, aisle: 'Pasillo 3C' },
  { sku: 'CHO-TOD-400', ean: '7591012300175', name: 'Modificador de Leche Toddy 400g', desc: 'Bebida achocolatada instantánea con vitaminas', dept: 0, grp: 5, brand: 'Toddy', unit: 'PAQ', cost: 2.80, price: 3.90, sup: 0, isExempt: false, stock1: 180, stock2: 45, aisle: 'Pasillo 4A' },
  { sku: 'CHO-SAV-CAR', ean: '7591012300182', name: 'Chocolate con Leche Savoy Carré 100g', desc: 'Tableta de chocolate con avellanas troceadas', dept: 0, grp: 5, brand: 'Savoy', unit: 'UNID', cost: 1.85, price: 2.60, sup: 1, isExempt: false, stock1: 220, stock2: 60, aisle: 'Pasillo 4A' },
  { sku: 'GAL-PUI-MAR', ean: '7591012300199', name: 'Galletas María Puig Paquete 150g', desc: 'Galletas dulces tradicionales de harina de trigo', dept: 0, grp: 6, brand: 'Puig', unit: 'PAQ', cost: 0.85, price: 1.25, sup: 8, isExempt: false, stock1: 420, stock2: 110, aisle: 'Pasillo 4B' },
  { sku: 'GAL-CLU-SOC', ean: '7591012300205', name: 'Galletas Club Social Original 6 Pack', desc: 'Galletas saladas crujientes empacadas individualmente', dept: 0, grp: 6, brand: 'Club Social', unit: 'PAQ', cost: 1.50, price: 2.10, sup: 2, isExempt: false, stock1: 360, stock2: 95, aisle: 'Pasillo 4B' },
  { sku: 'GAL-ORE-CHO', ean: '7591012300212', name: 'Galletas Oreo Chocolate 108g', desc: 'Galletas sándwich rellenas con crema dulce', dept: 0, grp: 6, brand: 'Oreo', unit: 'PAQ', cost: 0.95, price: 1.40, sup: 2, isExempt: false, stock1: 300, stock2: 85, aisle: 'Pasillo 4B' },

  // LÁCTEOS Y EMBUTIDOS
  { sku: 'LEC-CAM-1KG', ean: '7591012300229', name: 'Leche en Polvo Completa La Campesina 1 Kg', desc: 'Leche completa pasteurizada instantánea', dept: 1, grp: 8, brand: 'La Campesina', unit: 'KG', cost: 6.80, price: 9.30, sup: 0, isExempt: true, stock1: 310, stock2: 70, aisle: 'Pasillo 5A' },
  { sku: 'LEC-MIV-LIT', ean: '7591012300236', name: 'Leche Líquida Pasteurizada Mi Vaca 1 Litro', desc: 'Leche líquida fresca entera refrigerada', dept: 1, grp: 8, brand: 'Mi Vaca', unit: 'LITRO', cost: 1.30, price: 1.80, sup: 7, isExempt: true, stock1: 180, stock2: 40, aisle: 'Nevera Lácteos' },
  { sku: 'QUE-PAI-500', ean: '7591012300243', name: 'Queso Blanco Pasteurizado Paisa 500g', desc: 'Queso blanco semiduro pasteurizado empacado al vacío', dept: 1, grp: 9, brand: 'Paisa', unit: 'PAQ', cost: 3.40, price: 4.80, sup: 7, isExempt: true, stock1: 150, stock2: 35, aisle: 'Nevera Lácteos' },
  { sku: 'QUE-TOR-250', ean: '7591012300250', name: 'Queso Amarillo Torondoy Cuña 250g', desc: 'Queso tipo gouda madurado nacional', dept: 1, grp: 9, brand: 'Torondoy', unit: 'PAQ', cost: 2.80, price: 3.95, sup: 7, isExempt: false, stock1: 120, stock2: 30, aisle: 'Nevera Lácteos' },
  { sku: 'JAM-PLU-SUP', ean: '7591012300267', name: 'Jamón Cocido Superior Plumrose 1 Kg', desc: 'Jamón cocido de pierna selecta pieza para rebanar', dept: 1, grp: 10, brand: 'Plumrose', unit: 'KG', cost: 7.50, price: 10.50, sup: 6, isExempt: false, stock1: 85, stock2: 25, aisle: 'Charcutería' },
  { sku: 'SAL-PLU-VIE', ean: '7591012300274', name: 'Salchichas Viena Plumrose Paquete 8 Unid.', desc: 'Salchichas tradicionales cocidas de cerdo y pollo', dept: 1, grp: 10, brand: 'Plumrose', unit: 'PAQ', cost: 1.70, price: 2.45, sup: 6, isExempt: false, stock1: 190, stock2: 50, aisle: 'Charcutería' },
  { sku: 'TOC-PLU-250', ean: '7591012300281', name: 'Tocineta Ahumada Plumrose 250g', desc: 'Tocineta rebanada curada y ahumada', dept: 1, grp: 10, brand: 'Plumrose', unit: 'PAQ', cost: 2.90, price: 4.15, sup: 6, isExempt: false, stock1: 110, stock2: 30, aisle: 'Charcutería' },

  // CARNICERÍA Y AVÍCOLA
  { sku: 'CAR-POL-ENT', ean: '7591012300298', name: 'Pollo Entero Beneficiado La Morita 1 Kg', desc: 'Pollo fresco entero beneficiado sin vísceras', dept: 2, grp: 12, brand: 'La Morita', unit: 'KG', cost: 2.10, price: 2.90, sup: 15, isExempt: true, stock1: 250, stock2: 70, aisle: 'Nevera Aves' },
  { sku: 'CAR-PEC-POL', ean: '7591012300304', name: 'Pechuga de Pollo con Hueso 1 Kg', desc: 'Pechuga de pollo fresca de primera', dept: 2, grp: 12, brand: 'La Morita', unit: 'KG', cost: 3.40, price: 4.60, sup: 15, isExempt: true, stock1: 180, stock2: 50, aisle: 'Nevera Aves' },
  { sku: 'CAR-RES-MOL', ean: '7591012300311', name: 'Carne de Res Molida de Primera 1 Kg', desc: 'Carne molida magra de res fresca', dept: 2, grp: 11, brand: 'Frigocentro', unit: 'KG', cost: 5.20, price: 7.20, sup: 16, isExempt: true, stock1: 160, stock2: 40, aisle: 'Carnicería' },
  { sku: 'CAR-RES-SOL', ean: '7591012300328', name: 'Solomo de Cuerito Fresco 1 Kg', desc: 'Corte parrillero tierno de res nacional', dept: 2, grp: 11, brand: 'Frigocentro', unit: 'KG', cost: 6.80, price: 9.40, sup: 16, isExempt: true, stock1: 120, stock2: 30, aisle: 'Carnicería' },
  { sku: 'HUE-MOR-CRT', ean: '7591012300335', name: 'Cartón de Huevos La Morita 30 Unid.', desc: 'Huevos de gallina frescos seleccionados clase A', dept: 2, grp: 12, brand: 'La Morita', unit: 'PAQ', cost: 3.60, price: 4.80, sup: 15, isExempt: true, stock1: 140, stock2: 45, aisle: 'Nevera Aves' },

  // BEBIDAS Y REFRESCOS
  { sku: 'BEB-PEP-15L', ean: '7591012300342', name: 'Refresco Pepsi Regular Botella 1.5 Litros', desc: 'Bebida gaseosa sabor cola regular', dept: 3, grp: 14, brand: 'Pepsi', unit: 'UNID', cost: 1.20, price: 1.70, sup: 0, isExempt: false, stock1: 300, stock2: 90, aisle: 'Pasillo 6A' },
  { sku: 'BEB-7UP-15L', ean: '7591012300359', name: 'Refresco 7Up Lima Limón 1.5 Litros', desc: 'Bebida gaseosa transparente sabor lima-limón', dept: 3, grp: 14, brand: '7Up', unit: 'UNID', cost: 1.20, price: 1.70, sup: 0, isExempt: false, stock1: 220, stock2: 60, aisle: 'Pasillo 6A' },
  { sku: 'BEB-AGU-MIN', ean: '7591012300366', name: 'Agua Mineral Minalba sin Gas 1.5 L', desc: 'Agua mineral natural de manantial sin gas', dept: 3, grp: 15, brand: 'Minalba', unit: 'UNID', cost: 0.70, price: 1.10, sup: 0, isExempt: true, stock1: 400, stock2: 120, aisle: 'Pasillo 6B' },
  { sku: 'BEB-MAL-POL', ean: '7591012300373', name: 'Maltín Polar Botella 250ml', desc: 'Bebida de malta energizante sin alcohol', dept: 3, grp: 16, brand: 'Maltín Polar', unit: 'UNID', cost: 0.65, price: 0.95, sup: 0, isExempt: false, stock1: 550, stock2: 150, aisle: 'Pasillo 6B' },

  // CERVEZAS Y LICORES
  { sku: 'LIC-CER-PIL', ean: '7591012300380', name: 'Cerveza Polar Pilsen Botella 222ml', desc: 'Cerveza pilsen tradicional tipo dorada', dept: 4, grp: 17, brand: 'Polar Pilsen', unit: 'UNID', cost: 0.85, price: 1.25, sup: 4, isExempt: false, stock1: 600, stock2: 180, aisle: 'Pasillo 7A' },
  { sku: 'LIC-CER-LIG', ean: '7591012300397', name: 'Cerveza Polar Light Botella 222ml', desc: 'Cerveza suave bajo contenido calórico', dept: 4, grp: 17, brand: 'Polar Light', unit: 'UNID', cost: 0.85, price: 1.25, sup: 4, isExempt: false, stock1: 500, stock2: 140, aisle: 'Pasillo 7A' },
  { sku: 'LIC-CER-REG', ean: '7591012300403', name: 'Cerveza Regional Clara Botella 222ml', desc: 'Cerveza clara sabor refrescante', dept: 4, grp: 17, brand: 'Regional', unit: 'UNID', cost: 0.80, price: 1.20, sup: 5, isExempt: false, stock1: 400, stock2: 110, aisle: 'Pasillo 7A' },
  { sku: 'LIC-RON-STR', ean: '7591012300410', name: 'Ron Añejo Santa Teresa Gran Reserva 750ml', desc: 'Ron añejo venezolano de solera de roble blanco', dept: 4, grp: 18, brand: 'Santa Teresa', unit: 'UNID', cost: 7.20, price: 10.50, sup: 3, isExempt: false, stock1: 180, stock2: 45, aisle: 'Pasillo 7B' },
  { sku: 'LIC-RON-CAC', ean: '7591012300427', name: 'Ron Cacique Añejo Tradicional 750ml', desc: 'Ron dorado venezolano añejado en barricas', dept: 4, grp: 18, brand: 'Cacique', unit: 'UNID', cost: 6.90, price: 9.80, sup: 3, isExempt: false, stock1: 150, stock2: 40, aisle: 'Pasillo 7B' },

  // CUIDADO PERSONAL
  { sku: 'CP-COL-TRI', ean: '7591012300434', name: 'Crema Dental Colgate Triple Acción 100ml', desc: 'Protección anticaries, blancura y aliento fresco', dept: 5, grp: 19, brand: 'Colgate', unit: 'UNID', cost: 1.35, price: 1.95, sup: 12, isExempt: false, stock1: 340, stock2: 90, aisle: 'Pasillo 8A' },
  { sku: 'CP-JAB-PRO', ean: '7591012300441', name: 'Jabón de Tocador Protex Antibacterial 110g', desc: 'Jabón en barra protección natural antibacteriana', dept: 5, grp: 19, brand: 'Protex', unit: 'UNID', cost: 0.85, price: 1.25, sup: 12, isExempt: false, stock1: 450, stock2: 120, aisle: 'Pasillo 8A' },
  { sku: 'CP-CHA-PAN', ean: '7591012300458', name: 'Champú Pantene Pro-V Restauración 400ml', desc: 'Champú con micro-nutrientes restaurador capilar', dept: 5, grp: 20, brand: 'Pantene', unit: 'UNID', cost: 3.50, price: 4.95, sup: 13, isExempt: false, stock1: 160, stock2: 45, aisle: 'Pasillo 8B' },
  { sku: 'CP-DES-REX', ean: '7591012300465', name: 'Desodorante Rexona Clinical Aerosol 150ml', desc: 'Protección antitranspirante 3 veces más eficaz', dept: 5, grp: 19, brand: 'Rexona', unit: 'UNID', cost: 3.20, price: 4.60, sup: 13, isExempt: false, stock1: 140, stock2: 40, aisle: 'Pasillo 8B' },
  { sku: 'CP-PAP-SCO', ean: '7591012300472', name: 'Papel Higiénico Scott Rinde Más 4 Rollos', desc: 'Papel higiénico doble hoja suave y resistente', dept: 5, grp: 21, brand: 'Scott', unit: 'PAQ', cost: 1.80, price: 2.65, sup: 14, isExempt: false, stock1: 280, stock2: 75, aisle: 'Pasillo 9A' },

  // LIMPIEZA DEL HOGAR
  { sku: 'LIM-DET-ARI', ean: '7591012300489', name: 'Detergente en Polvo Ariel Doble Poder 1 Kg', desc: 'Detergente con aceleradores de lavado para ropa blanca y color', dept: 6, grp: 22, brand: 'Ariel', unit: 'KG', cost: 2.70, price: 3.85, sup: 13, isExempt: false, stock1: 290, stock2: 80, aisle: 'Pasillo 9B' },
  { sku: 'LIM-CLO-CLO', ean: '7591012300496', name: 'Cloro Tradicional Blanqueador Clorox 1 Litro', desc: 'Desinfectante y blanqueador para ropa y superficies', dept: 6, grp: 23, brand: 'Clorox', unit: 'LITRO', cost: 1.10, price: 1.60, sup: 12, isExempt: false, stock1: 320, stock2: 85, aisle: 'Pasillo 10A' },
  { sku: 'LIM-AXI-LIM', ean: '7591012300502', name: 'Lavaplatos en Crema Axion Limón 450g', desc: 'Crema arrancagrasa concentrada con aroma cítrico', dept: 6, grp: 24, brand: 'Axion', unit: 'UNID', cost: 1.45, price: 2.15, sup: 12, isExempt: false, stock1: 260, stock2: 70, aisle: 'Pasillo 10A' },
  { sku: 'LIM-MIS-LAV', ean: '7591012300519', name: 'Desinfectante Multiusos Mistolín Lavanda 1 L', desc: 'Limpiador líquido aromatizante para pisos', dept: 6, grp: 23, brand: 'Mistolín', unit: 'LITRO', cost: 1.35, price: 1.95, sup: 12, isExempt: false, stock1: 270, stock2: 70, aisle: 'Pasillo 10B' },

  // FRUTAS Y HORTALIZAS
  { sku: 'FRU-TOM-MAN', ean: '7591012300526', name: 'Tomate Manzano Fresco 1 Kg', desc: 'Tomate de perita para ensaladas y salsas', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.20, price: 1.85, sup: 17, isExempt: true, stock1: 150, stock2: 50, aisle: 'Área Verduras' },
  { sku: 'FRU-CEB-BLA', ean: '7591012300533', name: 'Cebolla Blanca Seleccionada 1 Kg', desc: 'Cebolla blanca nacional de cultivo andino', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.10, price: 1.70, sup: 17, isExempt: true, stock1: 180, stock2: 60, aisle: 'Área Verduras' },
  { sku: 'FRU-PAP-AND', ean: '7591012300540', name: 'Papa Blanca de los Andes 1 Kg', desc: 'Papa fresca lavada especial para puré y freír', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 1.25, price: 1.90, sup: 17, isExempt: true, stock1: 220, stock2: 70, aisle: 'Área Verduras' },
  { sku: 'FRU-PLA-MAD', ean: '7591012300557', name: 'Plátano Maduro de Primera 1 Kg', desc: 'Plátano maduro venezolano racimo seleccionado', dept: 7, grp: 25, brand: 'La Morita', unit: 'KG', cost: 0.90, price: 1.40, sup: 17, isExempt: true, stock1: 200, stock2: 60, aisle: 'Área Verduras' },
];

const departments = [
  'dep11111-0000-0000-0000-000000000001',
  'dep11111-0000-0000-0000-000000000002',
  'dep11111-0000-0000-0000-000000000003',
  'dep11111-0000-0000-0000-000000000004',
  'dep11111-0000-0000-0000-000000000005',
  'dep11111-0000-0000-0000-000000000006',
  'dep11111-0000-0000-0000-000000000007',
  'dep11111-0000-0000-0000-000000000008',
];

const groups = [
  'grp11111-0000-0000-0000-000000000001',
  'grp11111-0000-0000-0000-000000000002',
  'grp11111-0000-0000-0000-000000000003',
  'grp11111-0000-0000-0000-000000000004',
  'grp11111-0000-0000-0000-000000000005',
  'grp11111-0000-0000-0000-000000000006',
  'grp11111-0000-0000-0000-000000000007',
  'grp11111-0000-0000-0000-000000000008',
  'grp11111-0000-0000-0000-000000000009',
  'grp11111-0000-0000-0000-000000000010',
  'grp11111-0000-0000-0000-000000000011',
  'grp11111-0000-0000-0000-000000000012',
  'grp11111-0000-0000-0000-000000000013',
  'grp11111-0000-0000-0000-000000000014',
  'grp11111-0000-0000-0000-000000000015',
  'grp11111-0000-0000-0000-000000000016',
  'grp11111-0000-0000-0000-000000000017',
  'grp11111-0000-0000-0000-000000000018',
  'grp11111-0000-0000-0000-000000000019',
  'grp11111-0000-0000-0000-000000000020',
  'grp11111-0000-0000-0000-000000000021',
  'grp11111-0000-0000-0000-000000000022',
  'grp11111-0000-0000-0000-000000000023',
  'grp11111-0000-0000-0000-000000000024',
  'grp11111-0000-0000-0000-000000000025',
  'grp11111-0000-0000-0000-000000000026',
];

const suppliers = [
  'sup11111-0000-0000-0000-000000000001',
  'sup11111-0000-0000-0000-000000000002',
  'sup11111-0000-0000-0000-000000000003',
  'sup11111-0000-0000-0000-000000000004',
  'sup11111-0000-0000-0000-000000000005',
  'sup11111-0000-0000-0000-000000000006',
  'sup11111-0000-0000-0000-000000000007',
  'sup11111-0000-0000-0000-000000000008',
  'sup11111-0000-0000-0000-000000000009',
  'sup11111-0000-0000-0000-000000000010',
  'sup11111-0000-0000-0000-000000000011',
  'sup11111-0000-0000-0000-000000000012',
  'sup11111-0000-0000-0000-000000000013',
  'sup11111-0000-0000-0000-000000000014',
  'sup11111-0000-0000-0000-000000000015',
  'sup11111-0000-0000-0000-000000000016',
  'sup11111-0000-0000-0000-000000000017',
  'sup11111-0000-0000-0000-000000000018',
];

export function generateHypermarketSeedSql(): string {
  return `-- =============================================================================
-- ERO ERP - SCRIPT DE INICIALIZACIÓN / LIMPIEZA Y CARGA DE DATOS DE HIPERMERCADO
-- Ámbito: Mercado Venezolano (Hipermercado de Consumo Masivo)
-- Preserva: Usuarios, Roles, Permisos, Licencias, Empresa y Configuración
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Obtención de Identificadores Base (Empresa, Sucursal y Almacenes)
SELECT id INTO @company_id FROM companies LIMIT 1;
SELECT id INTO @branch_id FROM branches WHERE company_id = @company_id ORDER BY is_main DESC LIMIT 1;

-- Si no hay almacenes definidos, se asignan valores por defecto
SELECT id INTO @wh_main FROM warehouses WHERE branch_id = @branch_id ORDER BY is_default DESC LIMIT 1;
SELECT id INTO @wh_store FROM warehouses WHERE branch_id = @branch_id AND id != @wh_main LIMIT 1;
SET @wh_store = COALESCE(@wh_store, @wh_main);

-- Tasas de Impuesto SENIAT (Exento y 16%)
SELECT id INTO @tax_exempt_id FROM tax_rates WHERE company_id = @company_id AND type = 'EXENTO' LIMIT 1;
SELECT id INTO @tax_iva16_id FROM tax_rates WHERE company_id = @company_id AND type = 'IVA' AND rate = 16.00 LIMIT 1;

-- Si no existen tasas, crearlas
INSERT INTO tax_rates (id, company_id, code, name, rate, type, is_active)
VALUES 
  (COALESCE(@tax_exempt_id, 't4444444-4444-4444-4444-444444444444'), @company_id, 'EXENTO', 'Productos y Servicios Exentos', 0.00, 'EXENTO', 1),
  (COALESCE(@tax_iva16_id, 't1111111-1111-1111-1111-111111111111'), @company_id, 'IVA_16', 'IVA Alícuota General (16%)', 16.00, 'IVA', 1)
ON DUPLICATE KEY UPDATE rate = VALUES(rate);

SET @tax_exempt_id = COALESCE(@tax_exempt_id, 't4444444-4444-4444-4444-444444444444');
SET @tax_iva16_id = COALESCE(@tax_iva16_id, 't1111111-1111-1111-1111-111111111111');

-- 2. Limpieza de Tablas Transaccionales y Catálogos Operativos Anteriores
DELETE FROM sales_payments;
DELETE FROM sales_invoice_items;
DELETE FROM sales_invoices;
DELETE FROM sales_quotation_items;
DELETE FROM sales_quotations;
DELETE FROM delivery_note_items;
DELETE FROM delivery_notes;
DELETE FROM customer_note_applications;
DELETE FROM customer_note_items;
DELETE FROM customer_notes;
DELETE FROM receivables;
DELETE FROM purchase_payments;
DELETE FROM purchase_invoice_items;
DELETE FROM purchase_invoices;
DELETE FROM payables;
DELETE FROM supplier_note_applications;
DELETE FROM supplier_note_items;
DELETE FROM supplier_notes;
DELETE FROM goods_receipt_items;
DELETE FROM goods_receipts;
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;
DELETE FROM tax_withholdings_iva;
DELETE FROM tax_withholdings_islr;
DELETE FROM cash_shift_deposits;
DELETE FROM cash_audit_notifications;
DELETE FROM cash_movements;
DELETE FROM fiscal_reports;
DELETE FROM cash_shifts;
DELETE FROM inventory_movements;
DELETE FROM inventory_adjustment_items;
DELETE FROM inventory_adjustments;
DELETE FROM inventory_transfer_items;
DELETE FROM inventory_transfers;
DELETE FROM product_lots;
DELETE FROM product_stocks;
DELETE FROM product_prices;
DELETE FROM product_locations;
DELETE FROM product_presentations;
DELETE FROM product_skus;
DELETE FROM supplier_products;
DELETE FROM price_history;
DELETE FROM price_change_items;
DELETE FROM price_change_batches;
DELETE FROM price_lists;
DELETE FROM products;
DELETE FROM presentations;
DELETE FROM units_of_measure;
DELETE FROM brands;
DELETE FROM subgroups;
DELETE FROM \`groups\`;
DELETE FROM departments;
DELETE FROM bank_reconciliations;
DELETE FROM bank_movements;
DELETE FROM bank_accounts;
DELETE FROM banks;
DELETE FROM customers;
DELETE FROM suppliers;
DELETE FROM restaurant_order_items;
DELETE FROM restaurant_orders;
DELETE FROM restaurant_table_closures;
DELETE FROM accounting_journal_lines;
DELETE FROM accounting_journal_entries;
DELETE FROM notifications;
DELETE FROM user_notification_preferences;
DELETE FROM email_logs;

-- 3. Bancos Oficiales Venezolanos (SUDEBAN)
INSERT INTO banks (id, code, name, is_active) VALUES
('b0134000-0000-0000-0000-000000000134', '0134', 'Banesco Banco Universal', 1),
('b0102000-0000-0000-0000-000000000102', '0102', 'Banco de Venezuela S.A.C.A.', 1),
('b0105000-0000-0000-0000-000000000105', '0105', 'Banco Mercantil C.A.', 1),
('b0108000-0000-0000-0000-000000000108', '0108', 'BBVA Banco Provincial', 1),
('b0172000-0000-0000-0000-000000000172', '0172', 'Bancamiga Banco Universal', 1),
('b0191000-0000-0000-0000-000000000191', '0191', 'Banco Nacional de Crédito (BNC)', 1),
('b0114000-0000-0000-0000-000000000114', '0114', 'Bancaribe C.A.', 1),
('b0115000-0000-0000-0000-000000000115', '0115', 'Banco Exterior C.A.', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4. Cuentas Bancarias Operativas (VES y USD Custodia)
INSERT INTO bank_accounts (id, company_id, bank_id, branch_id, account_number, account_type, currency, description, current_balance, is_active) VALUES
('acc11111-0000-0000-0000-000000000001', @company_id, 'b0134000-0000-0000-0000-000000000134', @branch_id, '01340001121234567890', 'CURRENT', 'VES', 'Banesco Principal Corriente Operativa (Bs.)', 154200.50, 1),
('acc11111-0000-0000-0000-000000000002', @company_id, 'b0102000-0000-0000-0000-000000000102', @branch_id, '01020110349876543210', 'CURRENT', 'VES', 'Banco de Venezuela Nómina y Recaudación (Bs.)', 89340.20, 1),
('acc11111-0000-0000-0000-000000000003', @company_id, 'b0105000-0000-0000-0000-000000000105', @branch_id, '01050022881122334455', 'CURRENT', 'VES', 'Mercantil Recaudación POS (Bs.)', 67450.00, 1),
('acc11111-0000-0000-0000-000000000004', @company_id, 'b0172000-0000-0000-0000-000000000172', @branch_id, '01720111559988776655', 'CUSTODY_USD', 'USD', 'Bancamiga Cuenta Especial Custodia Divisas ($)', 12850.00, 1),
('acc11111-0000-0000-0000-000000000005', @company_id, 'b0134000-0000-0000-0000-000000000134', @branch_id, '01340999775544332211', 'CUSTODY_USD', 'USD', 'Banesco Cuenta Verde Libre Convertibilidad ($)', 24600.00, 1);

-- 5. Proveedores Venezolanos de Consumo Masivo
INSERT INTO suppliers (id, company_id, rif, name, fiscal_address, phone, email, is_resident, islr_concept_code, credit_limit, payment_terms_days, is_active) VALUES
('sup11111-0000-0000-0000-000000000001', @company_id, 'J-00006548-0', 'ALIMENTOS POLAR COMERCIAL C.A.', 'Av. 4, Los Cortijos de Lourdes, Caracas', '+58 212 202-3111', 'atencion.proveedor@empresaspolar.com', 1, 'SERV_IND', 50000.00, 30, 1),
('sup11111-0000-0000-0000-000000000002', @company_id, 'J-00034567-8', 'NESTLE VENEZUELA S.A.', 'Av. Eugenio Mendoza, Edif. Nestlé, La Urbina, Caracas', '+58 212 201-0111', 'pedidos@ve.nestle.com', 1, 'SERV_IND', 40000.00, 30, 1),
('sup11111-0000-0000-0000-000000000003', @company_id, 'J-00012398-4', 'MONDELEZ VZLA S.A.', 'Urb. Industrial Castillito, Valencia, Carabobo', '+58 241 874-1100', 'atencion.pedidos@mdlz.com', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000004', @company_id, 'J-00028912-1', 'C.A. RON SANTA TERESA', 'Hacienda Santa Teresa, El Consejo, Edo. Aragua', '+58 244 395-5111', 'distribucion@santateresa.com.ve', 1, 'SERV_IND', 35000.00, 30, 1),
('sup11111-0000-0000-0000-000000000005', @company_id, 'J-00045678-9', 'CERVECERIA POLAR C.A.', 'Av. 2da, Los Cortijos de Lourdes, Caracas', '+58 212 202-7777', 'ventas.cerveceria@empresaspolar.com', 1, 'SERV_IND', 60000.00, 15, 1),
('sup11111-0000-0000-0000-000000000006', @company_id, 'J-00011223-3', 'C.A. CERVECERIA REGIONAL', 'Zona Industrial II, Maracaibo, Edo. Zulia', '+58 261 736-2211', 'contacto@cerveceriaregional.com', 1, 'SERV_IND', 30000.00, 15, 1),
('sup11111-0000-0000-0000-000000000007', @company_id, 'J-00067890-1', 'PLUMROSE LATINOAMERICANA C.A.', 'Av. Sucre, Los Dos Caminos, Caracas', '+58 212 284-4411', 'ventas@plumrose.com', 1, 'SERV_IND', 30000.00, 21, 1),
('sup11111-0000-0000-0000-000000000008', @company_id, 'J-00078901-2', 'PAISA INDUSTRIAL C.A.', 'Carretera Panamericana Km 18, Los Teques, Edo. Miranda', '+58 212 383-1122', 'contacto@paisa.com.ve', 1, 'SERV_IND', 20000.00, 15, 1),
('sup11111-0000-0000-0000-000000000009', @company_id, 'J-00089012-3', 'GALLETAS PUIG C.A.', 'Calle Vargas, Boleíta Norte, Caracas', '+58 212 239-5566', 'pedidos@puig.com.ve', 1, 'SERV_IND', 18000.00, 21, 1),
('sup11111-0000-0000-0000-000000000010', @company_id, 'J-00090123-4', 'CENTRAL EL PALMAR S.A.', 'Carretera San Mateo, San Mateo, Edo. Aragua', '+58 244 321-4400', 'azucar@elpalmar.com.ve', 1, 'SERV_IND', 35000.00, 30, 1),
('sup11111-0000-0000-0000-000000000011', @company_id, 'J-00054321-0', 'CARGILL DE VENEZUELA S.R.L.', 'Av. Francisco de Miranda, Edif. Parque Cristal, Caracas', '+58 212 285-2233', 'ventas@cargill.com.ve', 1, 'SERV_IND', 45000.00, 30, 1),
('sup11111-0000-0000-0000-000000000012', @company_id, 'J-00043210-9', 'INDUSTRIAS DIANA C.A.', 'Zona Industrial Municipal Norte, Valencia, Carabobo', '+58 241 871-6600', 'ventas@diana.com.ve', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000013', @company_id, 'J-00032109-8', 'COLGATE-PALMOLIVE C.A.', 'Av. Diego Cisneros, Los Ruices, Caracas', '+58 212 207-1111', 'atencion@colgate.com.ve', 1, 'SERV_IND', 40000.00, 30, 1),
('sup11111-0000-0000-0000-000000000014', @company_id, 'J-00021098-7', 'PROCTER & GAMBLE DE VENEZUELA S.C.A.', 'Edif. P&G, Calle Altagracia, La Trinidad, Caracas', '+58 212 904-4111', 'contacto@pg.com.ve', 1, 'SERV_IND', 50000.00, 30, 1),
('sup11111-0000-0000-0000-000000000015', @company_id, 'J-00010987-6', 'KIMBERLY-CLARK VENEZUELA', 'Zona Industrial La Hamaca, Maracay, Aragua', '+58 243 236-8800', 'atencion@kcc.com.ve', 1, 'SERV_IND', 25000.00, 21, 1),
('sup11111-0000-0000-0000-000000000016', @company_id, 'J-30129845-0', 'AVICOLA LA MORITA C.A.', 'Carretera Nacional Turmero, Turmero, Edo. Aragua', '+58 244 663-1200', 'ventas@lamorita.com.ve', 1, 'SERV_IND', 20000.00, 15, 1),
('sup11111-0000-0000-0000-000000000017', @company_id, 'J-30981234-5', 'FRIGOCENTRO CARNICOS C.A.', 'Zona Industrial Sur, Valencia, Edo. Carabobo', '+58 241 832-5544', 'pedidos@frigocentro.com.ve', 1, 'SERV_IND', 35000.00, 15, 1),
('sup11111-0000-0000-0000-000000000018', @company_id, 'J-40123987-6', 'DISTRIBUIDORA HORTICOLA DE LOS ANDES C.A.', 'Mercado Mayorista de Barquisimeto, Edo. Lara', '+58 251 269-3322', 'horticola.andes@gmail.com', 1, 'SERV_IND', 15000.00, 10, 1);

-- 6. Clientes Venezolanos Diversificados
INSERT INTO customers (id, company_id, doc_type, doc_number, name, address, phone, email, is_special_taxpayer, credit_enabled, credit_limit, payment_terms_days, is_active) VALUES
('cli11111-0000-0000-0000-000000000001', @company_id, 'J', '401298456', 'AUTOMERCADOS Y BODEGONES SAN ANTONIO C.A.', 'Av. Las Delicias, Maracay, Edo. Aragua', '+58 243 241-9988', 'compras@sanantonio.com.ve', 1, 1, 15000.00, 21, 1),
('cli11111-0000-0000-0000-000000000002', @company_id, 'J', '409812345', 'BODEGÓN Y RESTAURANT EL PORTÓN GOURMET C.A.', 'Calle 72 con Av. Bella Vista, Maracaibo, Zulia', '+58 261 792-8811', 'elportongourmet@gmail.com', 0, 1, 8000.00, 15, 1),
('cli11111-0000-0000-0000-000000000003', @company_id, 'J', '501239874', 'INVERSIONES RESTAURANTE EL ASADOR CARACAS C.A.', 'Av. Blandín, CC San Ignacio, Caracas', '+58 212 263-4455', 'administracion@elasador.com.ve', 1, 1, 12000.00, 15, 1),
('cli11111-0000-0000-0000-000000000004', @company_id, 'J', '314567890', 'PANADERÍA Y PASTELERÍA FLOR DE LIS C.A.', 'Av. Bolívar Norte, Valencia, Edo. Carabobo', '+58 241 821-6677', 'flordelispan@gmail.com', 0, 1, 5000.00, 15, 1),
('cli11111-0000-0000-0000-000000000005', @company_id, 'J', '412398456', 'COMERCIALIZADORA ALIMENTOS MARGARITA S.A.', 'Av. 4 de Mayo, Porlamar, Edo. Nueva Esparta', '+58 295 264-1122', 'margaritacompras@gmail.com', 1, 1, 20000.00, 30, 1),
('cli11111-0000-0000-0000-000000000006', @company_id, 'V', '14567890', 'CARLOS ENRIQUE MENDOZA PÉREZ', 'Urb. Santa Mónica, Caracas', '+58 414 111-2233', 'cmendoza@gmail.com', 0, 1, 500.00, 15, 1),
('cli11111-0000-0000-0000-000000000007', @company_id, 'V', '18901234', 'MARÍA ALEJANDRA RODRÍGUEZ SILVA', 'Urb. El Rosal, Chacao, Caracas', '+58 412 333-4455', 'mrodriguez@gmail.com', 0, 1, 800.00, 15, 1),
('cli11111-0000-0000-0000-000000000008', @company_id, 'V', '12345678', 'GABRIEL JOSÉ HERNÁNDEZ SÁNCHEZ', 'Urb. La Trigaleña, Valencia, Carabobo', '+58 414 777-8899', 'ghernandez@hotmail.com', 0, 0, 0.00, 0, 1),
('cli11111-0000-0000-0000-000000000009', @company_id, 'V', '21345678', 'ANDREÍNA CHIRINOS ALVARADO', 'Av. Fuerzas Armadas, Maracaibo, Zulia', '+58 424 666-5544', 'achirinos@gmail.com', 0, 0, 0.00, 0, 1),
('cli11111-0000-0000-0000-000000000010', @company_id, 'V', '10987654', 'ROBERTO ANTONIO SALAZAR GÓMEZ', 'Sector Tierra Negra, Maracaibo, Zulia', '+58 416 888-9900', 'rsalazar@yahoo.com', 0, 1, 300.00, 10, 1);

-- 7. Departamentos, Grupos y Marcas
INSERT INTO departments (id, company_id, code, name, description, is_active) VALUES
('dep11111-0000-0000-0000-000000000001', @company_id, 'DEP-VIV', 'Víveres y Despensa', 'Granos, harinas, pastas, aceites, enlatados y abarrotes', 1),
('dep11111-0000-0000-0000-000000000002', @company_id, 'DEP-REF', 'Lácteos y Refrigerados', 'Leches, quesos, embutidos y derivados', 1),
('dep11111-0000-0000-0000-000000000003', @company_id, 'DEP-CAR', 'Carnicería y Aves', 'Carnes de res, pollo beneficiado, cerdo y charcutería fresca', 1),
('dep11111-0000-0000-0000-000000000004', @company_id, 'DEP-BEB', 'Bebidas y Refrescos', 'Gaseosas, aguas, jugos y maltas', 1),
('dep11111-0000-0000-0000-000000000005', @company_id, 'DEP-LIC', 'Licores y Cervezas', 'Cervezas nacionales, rones venezolanos y licores', 1),
('dep11111-0000-0000-0000-000000000006', @company_id, 'DEP-CP', 'Cuidado Personal y Farmacia', 'Cuidado oral, jabones, champús y toallas higiénicas', 1),
('dep11111-0000-0000-0000-000000000007', @company_id, 'DEP-LIM', 'Limpieza del Hogar', 'Detergentes, cloros, lavaplatos y desinfectantes', 1),
('dep11111-0000-0000-0000-000000000008', @company_id, 'DEP-FRU', 'Frutas y Hortalizas', 'Frutas frescas, verduras, tubérculos y legumbres', 1);

INSERT INTO \`groups\` (id, department_id, code, name, is_active) VALUES
('grp11111-0000-0000-0000-000000000001', 'dep11111-0000-0000-0000-000000000001', 'GRP-HAR', 'Harinas y Mezclas', 1),
('grp11111-0000-0000-0000-000000000002', 'dep11111-0000-0000-0000-000000000001', 'GRP-ARR', 'Arroces y Granos', 1),
('grp11111-0000-0000-0000-000000000003', 'dep11111-0000-0000-0000-000000000001', 'GRP-PAS', 'Pastas Alimenticias', 1),
('grp11111-0000-0000-0000-000000000004', 'dep11111-0000-0000-0000-000000000001', 'GRP-ACE', 'Aceites y Mantecas', 1),
('grp11111-0000-0000-0000-000000000005', 'dep11111-0000-0000-0000-000000000001', 'GRP-ENL', 'Enlatados y Conservas', 1),
('grp11111-0000-0000-0000-000000000006', 'dep11111-0000-0000-0000-000000000001', 'GRP-DUL', 'Azúcar, Café y Chocolates', 1),
('grp11111-0000-0000-0000-000000000007', 'dep11111-0000-0000-0000-000000000001', 'GRP-GAL', 'Galletas y Confitería', 1),
('grp11111-0000-0000-0000-000000000008', 'dep11111-0000-0000-0000-000000000001', 'GRP-SAL', 'Salsas y Condimentos', 1),
('grp11111-0000-0000-0000-000000000009', 'dep11111-0000-0000-0000-000000000002', 'GRP-LEC', 'Leches y Lácteos', 1),
('grp11111-0000-0000-0000-000000000010', 'dep11111-0000-0000-0000-000000000002', 'GRP-QUE', 'Quesos y Mantequillas', 1),
('grp11111-0000-0000-0000-000000000011', 'dep11111-0000-0000-0000-000000000002', 'GRP-EMB', 'Embutidos y Madurados', 1),
('grp11111-0000-0000-0000-000000000012', 'dep11111-0000-0000-0000-000000000003', 'GRP-RES', 'Carne de Res', 1),
('grp11111-0000-0000-0000-000000000013', 'dep11111-0000-0000-0000-000000000003', 'GRP-AVE', 'Pollo y Huevos', 1),
('grp11111-0000-0000-0000-000000000014', 'dep11111-0000-0000-0000-000000000003', 'GRP-CER', 'Cerdo y Cortes', 1),
('grp11111-0000-0000-0000-000000000015', 'dep11111-0000-0000-0000-000000000004', 'GRP-REF', 'Refrescos y Gaseosas', 1),
('grp11111-0000-0000-0000-000000000016', 'dep11111-0000-0000-0000-000000000004', 'GRP-AGU', 'Aguas y Jugos', 1),
('grp11111-0000-0000-0000-000000000017', 'dep11111-0000-0000-0000-000000000004', 'GRP-MAL', 'Maltas', 1),
('grp11111-0000-0000-0000-000000000018', 'dep11111-0000-0000-0000-000000000005', 'GRP-CERV', 'Cervezas', 1),
('grp11111-0000-0000-0000-000000000019', 'dep11111-0000-0000-0000-000000000005', 'GRP-RON', 'Rones y Espirituosos', 1),
('grp11111-0000-0000-0000-000000000020', 'dep11111-0000-0000-0000-000000000006', 'GRP-HIG', 'Higiene y Cuidado Oral', 1),
('grp11111-0000-0000-0000-000000000021', 'dep11111-0000-0000-0000-000000000006', 'GRP-CAP', 'Cuidado Capilar', 1),
('grp11111-0000-0000-0000-000000000022', 'dep11111-0000-0000-0000-000000000006', 'GRP-PAP', 'Papel Higiénico y Pañales', 1),
('grp11111-0000-0000-0000-000000000023', 'dep11111-0000-0000-0000-000000000007', 'GRP-DET', 'Detergentes y Jabones', 1),
('grp11111-0000-0000-0000-000000000024', 'dep11111-0000-0000-0000-000000000007', 'GRP-DESI', 'Desinfectantes y Cloros', 1),
('grp11111-0000-0000-0000-000000000025', 'dep11111-0000-0000-0000-000000000007', 'GRP-LAV', 'Lavaplatos y Limpieza Cocina', 1),
('grp11111-0000-0000-0000-000000000026', 'dep11111-0000-0000-0000-000000000008', 'GRP-HOR', 'Verduras y Hortalizas', 1);

INSERT INTO brands (id, company_id, name, is_active) VALUES
(UUID(), @company_id, 'P.A.N.', 1),
(UUID(), @company_id, 'Mavesa', 1),
(UUID(), @company_id, 'Primor', 1),
(UUID(), @company_id, 'Mary', 1),
(UUID(), @company_id, 'Mazeite', 1),
(UUID(), @company_id, 'Diana', 1),
(UUID(), @company_id, 'Ronco', 1),
(UUID(), @company_id, 'La Lucha', 1),
(UUID(), @company_id, 'Montalbán', 1),
(UUID(), @company_id, 'Fama de América', 1),
(UUID(), @company_id, 'Toddy', 1),
(UUID(), @company_id, 'Savoy', 1),
(UUID(), @company_id, 'Puig', 1),
(UUID(), @company_id, 'Club Social', 1),
(UUID(), @company_id, 'Oreo', 1),
(UUID(), @company_id, 'La Campesina', 1),
(UUID(), @company_id, 'Mi Vaca', 1),
(UUID(), @company_id, 'Paisa', 1),
(UUID(), @company_id, 'Torondoy', 1),
(UUID(), @company_id, 'Plumrose', 1),
(UUID(), @company_id, 'La Morita', 1),
(UUID(), @company_id, 'Frigocentro', 1),
(UUID(), @company_id, 'Pepsi', 1),
(UUID(), @company_id, '7Up', 1),
(UUID(), @company_id, 'Minalba', 1),
(UUID(), @company_id, 'Maltín Polar', 1),
(UUID(), @company_id, 'Polar Pilsen', 1),
(UUID(), @company_id, 'Polar Light', 1),
(UUID(), @company_id, 'Regional', 1),
(UUID(), @company_id, 'Santa Teresa', 1),
(UUID(), @company_id, 'Cacique', 1),
(UUID(), @company_id, 'Colgate', 1),
(UUID(), @company_id, 'Protex', 1),
(UUID(), @company_id, 'Pantene', 1),
(UUID(), @company_id, 'Rexona', 1),
(UUID(), @company_id, 'Scott', 1),
(UUID(), @company_id, 'Ariel', 1),
(UUID(), @company_id, 'Clorox', 1),
(UUID(), @company_id, 'Axion', 1),
(UUID(), @company_id, 'Mistolín', 1);

-- 8. Listas de Precios
SET @pl_detal = 'pl111111-0000-0000-0000-000000000001';
SET @pl_mayor = 'pl111111-0000-0000-0000-000000000002';
SET @pl_vip   = 'pl111111-0000-0000-0000-000000000003';

INSERT INTO price_lists (id, company_id, code, name, currency, is_default, is_active)
VALUES 
  (@pl_detal, @company_id, 'PL-DETAL', 'Precio Detal / Al Mayor', 'USD', 1, 1),
  (@pl_mayor, @company_id, 'PL-MAYOR', 'Precio Mayorista', 'USD', 0, 1),
  (@pl_vip, @company_id, 'PL-ESPECIAL', 'Precio Cliente Especial', 'USD', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);
`;
}

export function generateAllProductsSql(): string {
  let sql = `\n-- 9. Catálogo Extenso de 55 Productos de Hipermercado (con SKUs, Precios, Lotes y Stocks)\n`;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prodId = `prd11111-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
    const deptId = departments[p.dept];
    const grpId = groups[p.grp];
    const supId = suppliers[p.sup];
    const taxVar = p.isExempt ? '@tax_exempt_id' : '@tax_iva16_id';

    const pMayor = Number((p.price * 0.90).toFixed(2));
    const pVip = Number((p.price * 0.85).toFixed(2));

    sql += `\n-- Producto ${i + 1}: ${p.name}\n`;
    sql += `INSERT INTO products (
  id, company_id, sku, barcode, name, description,
  product_type, tracks_inventory,
  department_id, group_id, subgroup_id, supplier_id,
  brand, unit_of_measure, cost_price, base_price, currency,
  default_tax_rate_id, tax_inclusive, min_stock, max_stock,
  has_batches, has_serials, is_active
) VALUES (
  '${prodId}', @company_id, ${esc(p.sku)}, ${esc(p.ean)}, ${esc(p.name)}, ${esc(p.desc)},
  'physical', 1,
  '${deptId}', '${grpId}', NULL, '${supId}',
  ${esc(p.brand)}, ${esc(p.unit)}, ${p.cost}, ${p.price}, 'USD',
  ${taxVar}, 0, 20.00, 1000.00,
  1, 0, 1
);

INSERT INTO product_skus (id, product_id, sku, barcode, description, is_primary, cost_price, price, currency, is_active)
VALUES (UUID(), '${prodId}', ${esc(p.sku)}, ${esc(p.ean)}, ${esc('SKU Principal ' + p.name)}, 1, ${p.cost}, ${p.price}, 'USD', 1);

INSERT INTO product_prices (id, product_id, price_list_id, price, currency, valid_from)
VALUES 
  (UUID(), '${prodId}', @pl_detal, ${p.price}, 'USD', NOW()),
  (UUID(), '${prodId}', @pl_mayor, ${pMayor}, 'USD', NOW()),
  (UUID(), '${prodId}', @pl_vip, ${pVip}, 'USD', NOW());

INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), '${prodId}', 'Empaque Individual', ${esc(p.sku)}, ${esc(p.ean)}, ${esc(p.unit)}, 1.0000, ${p.cost}, ${p.price}, 'USD', 1, 0, 1);
`;

    if (p.unit === 'KG' || p.unit === 'PAQ' || p.unit === 'UNID') {
      const bMultiplier = 12;
      const bCost = Number((p.cost * bMultiplier * 0.95).toFixed(2));
      const bPrice = Number((p.price * bMultiplier * 0.92).toFixed(2));
      const bSku = `${p.sku}-B12`;
      const bBarcode = `759${p.ean.slice(3, -1)}9`;
      sql += `INSERT INTO product_presentations (id, product_id, name, sku, barcode, unit_of_measure, multiplier, cost_price, base_price, currency, is_default, requires_authorization, is_active)
VALUES (UUID(), '${prodId}', 'Bulto x 12 Unidades', ${esc(bSku)}, ${esc(bBarcode)}, 'BULTO', ${bMultiplier}, ${bCost}, ${bPrice}, 'USD', 0, 0, 1);
`;
    }

    // Stocks, Locations, and Lots (Almacén Principal)
    sql += `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
VALUES ('${prodId}', @wh_main, ${p.stock1}, 0, NOW());

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
VALUES (UUID(), '${prodId}', @wh_main, ${esc(p.aisle)}, 'Estante 01', 'Nivel 1', 'Sector Hipermercado');

INSERT INTO product_lots (id, company_id, product_id, warehouse_id, lot_number, manufacturing_date, expiration_date, initial_quantity, current_quantity, reserved_quantity, cost_price, status, notes)
VALUES (UUID(), @company_id, '${prodId}', @wh_main, ${esc('LOT-' + p.sku + '-2026')}, DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 18 MONTH), ${p.stock1}, ${p.stock1}, 0, ${p.cost}, 'ACTIVE', 'Lote de apertura hipermercado');
`;

    // Stocks and Locations (Piso de Venta)
    sql += `INSERT INTO product_stocks (product_id, warehouse_id, current_stock, reserved_stock, last_movement_at)
SELECT '${prodId}', @wh_store, ${p.stock2}, 0, NOW() WHERE @wh_store != @wh_main;

INSERT INTO product_locations (id, product_id, warehouse_id, aisle, shelf, compartment, notes)
SELECT UUID(), '${prodId}', @wh_store, ${esc(p.aisle)}, 'Góndola Central', 'Frente de Góndola', 'Piso de Venta Exhibición' WHERE @wh_store != @wh_main;
`;
  }

  sql += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
  return sql;
}

export function buildFullHypermarketSeedScript(): string {
  return generateHypermarketSeedSql() + generateAllProductsSql();
}

export function buildFullDatabaseInitScript(): string {
  const schemaSql = fs.readFileSync(path.join(ddlDir, '01_schema.sql'), 'utf8');
  const restaurantSql = fs.readFileSync(path.join(ddlDir, '06_restaurant.sql'), 'utf8');
  const accountingSql = fs.readFileSync(path.join(ddlDir, '07_accounting.sql'), 'utf8');
  const triggersSql = fs.readFileSync(path.join(ddlDir, '02_triggers.sql'), 'utf8');
  const proceduresSql = fs.readFileSync(path.join(ddlDir, '03_procedures.sql'), 'utf8');
  const viewsSql = fs.readFileSync(path.join(ddlDir, '04_views.sql'), 'utf8');
  const seedsSql = fs.readFileSync(path.join(ddlDir, '05_seeds.sql'), 'utf8');
  const hypermarketSql = buildFullHypermarketSeedScript();

  return `-- =============================================================================
-- ERO ERP - BOOTSTRAP UNIFICADO DE BASE DE DATOS (NUEVOS SERVIDORES)
-- Incluye: Esquema Completo + Módulos (Restaurante, Contabilidad, Notificaciones)
--         + Triggers + Stored Procedures + Vistas + Seeds Base + Datos de Hipermercado
-- Fecha: Noviembre 2026
-- =============================================================================

CREATE DATABASE IF NOT EXISTS \`ero_erp_db\` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_0900_ai_ci;

USE \`ero_erp_db\`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. ESQUEMA PRINCIPAL DE TABLAS (01_schema.sql)
-- -----------------------------------------------------------------------------
${schemaSql}

-- -----------------------------------------------------------------------------
-- 2. MÓDULO DE RESTAURANTE (06_restaurant.sql)
-- -----------------------------------------------------------------------------
${restaurantSql}

-- -----------------------------------------------------------------------------
-- 3. MÓDULO DE CONTABILIDAD Y NIIF (07_accounting.sql)
-- -----------------------------------------------------------------------------
${accountingSql}

-- -----------------------------------------------------------------------------
-- 4. DISPARADORES / TRIGGERS (02_triggers.sql)
-- -----------------------------------------------------------------------------
${triggersSql}

-- -----------------------------------------------------------------------------
-- 5. PROCEDIMIENTOS ALMACENADOS (03_procedures.sql)
-- -----------------------------------------------------------------------------
${proceduresSql}

-- -----------------------------------------------------------------------------
-- 6. VISTAS DEL SISTEMA (04_views.sql)
-- -----------------------------------------------------------------------------
${viewsSql}

-- -----------------------------------------------------------------------------
-- 7. SEMILLAS BASE DE CONFIGURACIÓN (05_seeds.sql)
-- -----------------------------------------------------------------------------
${seedsSql}

-- -----------------------------------------------------------------------------
-- 8. DATOS DE HIPERMERCADO VENEZOLANO (08_hypermarket_seed.sql)
-- -----------------------------------------------------------------------------
${hypermarketSql}

SET FOREIGN_KEY_CHECKS = 1;
`;
}

// Ejecución
const seed08 = buildFullHypermarketSeedScript();
fs.writeFileSync(path.join(ddlDir, '08_hypermarket_seed.sql'), seed08, 'utf8');
console.log(`✅ 08_hypermarket_seed.sql generado con éxito (${(seed08.length / 1024).toFixed(1)} KB)`);

const init00 = buildFullDatabaseInitScript();
fs.writeFileSync(path.join(ddlDir, '00_full_database_init.sql'), init00, 'utf8');
console.log(`✅ 00_full_database_init.sql generado con éxito (${(init00.length / 1024).toFixed(1)} KB)`);
