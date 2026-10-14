/**
 * Métodos de Valoración de Inventario y Alertas de Stock
 * Conforme a NIIF / Ven-NIF y principios contables aceptados
 */

/**
 * Calcula el Costo Promedio Ponderado tras una nueva entrada o compra
 * @param currentStock Stock físico existente previo a la entrada
 * @param currentAvgCost Costo promedio unitario anterior
 * @param incomingQty Cantidad que ingresa
 * @param incomingUnitCost Costo unitario de la nueva entrada
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  if (incomingQty <= 0) return Number(currentAvgCost.toFixed(4));
  
  // Si el stock actual es 0 o negativo, el nuevo costo promedio es el costo entrante
  if (currentStock <= 0) {
    return Number(incomingUnitCost.toFixed(4));
  }

  const previousTotalValue = currentStock * currentAvgCost;
  const incomingTotalValue = incomingQty * incomingUnitCost;
  const newTotalStock = currentStock + incomingQty;

  const newAvgCost = (previousTotalValue + incomingTotalValue) / newTotalStock;
  return Number(newAvgCost.toFixed(4));
}

/**
 * Determina el estado de inventario según niveles de stock mínimo y máximo
 */
export function determineStockStatus(
  availableStock: number,
  minStock: number,
  maxStock: number
): 'OUT_OF_STOCK' | 'CRITICAL_LOW' | 'OPTIMAL' | 'OVERSTOCK' {
  if (availableStock <= 0) {
    return 'OUT_OF_STOCK';
  }
  if (minStock > 0 && availableStock <= minStock) {
    return 'CRITICAL_LOW';
  }
  if (maxStock > 0 && availableStock > maxStock) {
    return 'OVERSTOCK';
  }
  return 'OPTIMAL';
}

/**
 * Calcula la cantidad sugerida para orden de compra o reposición
 */
export function calculateSuggestedReorderQuantity(
  availableStock: number,
  minStock: number,
  maxStock: number
): number {
  if (availableStock > minStock) {
    return 0;
  }
  if (maxStock > 0 && maxStock > availableStock) {
    return Number((maxStock - availableStock).toFixed(2));
  }
  // Si no hay max_stock configurado, reponer al menos el doble del stock mínimo
  return Number(Math.max(0, (minStock * 2) - availableStock).toFixed(2));
}
