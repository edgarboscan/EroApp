import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataTable, Column } from "../../components/ui/DataTable";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { PdfViewerModal } from "../../components/ui/PdfViewerModal";
import {
  Plus,
  MapPin,
  FileDown,
  RefreshCw,
  Search,
  Package,
  Layers,
  AlertCircle,
  Edit2,
  Trash2,
  Tag,
  Scale,
  Boxes,
  Warehouse,
  Calendar,
  Check,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/authStore";
import { formatMoneyUSD, formatNumber } from "../../utils/formatters";
import { showConfirmQuestion } from "../../lib/sweetalert";
import { ProductStockLotsModal } from "./ProductStockLotsModal";

// Interfaces de Producto
export interface ProductSkuItem {
  id?: string;
  sku: string;
  barcode?: string;
  description?: string;
  isPrimary?: boolean;
  costPrice?: number | null;
  price?: number | null;
  currency?: "USD" | "VES";
}

export interface ProductPresentationItem {
  id?: string;
  presentationId?: string;
  name: string;
  sku?: string;
  barcode?: string;
  unitOfMeasure: string;
  multiplier: number;
  costPrice: number;
  basePrice: number;
  currency?: "USD" | "VES";
  isDefault?: boolean;
  isActive?: boolean;
  requiresAuthorization?: boolean;
}

export interface ProductItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  productType?: "physical" | "service" | "kit" | "raw_material";
  tracksInventory?: boolean;
  departmentId?: string;
  departmentName?: string;
  groupId?: string;
  groupName?: string;
  subgroupId?: string;
  subgroupName?: string;
  supplierId?: string;
  brand?: string;
  unitOfMeasure: string;
  costPrice: number;
  basePrice: number;
  currency: "USD" | "VES";
  defaultTaxRateId?: string;
  taxRateName?: string;
  taxRate: number;
  taxInclusive?: boolean;
  minStock?: number;
  maxStock?: number;
  hasBatches?: boolean;
  hasSerials?: boolean;
  currentStock: number;
  aisle?: string;
  shelf?: string;
  compartment?: string;
  locations?: Array<{
    id?: string;
    warehouseId?: string;
    warehouseName?: string;
    aisle?: string;
    shelf?: string;
    compartment?: string;
    notes?: string;
  }>;
  isActive?: boolean;
  skusCount?: number;
  presentationsCount?: number;
  skus?: ProductSkuItem[];
  presentations?: ProductPresentationItem[];
}

// Entidades Auxiliares
export interface BrandItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface UnitOfMeasureItem {
  id: string;
  code: string;
  name: string;
  symbol?: string;
  isActive: boolean;
}

export interface PresentationTemplateItem {
  id: string;
  name: string;
  description?: string;
  defaultMultiplier: number;
  defaultUnit: string;
  isActive: boolean;
  requiresAuthorization?: boolean;
}

export interface Department {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  departmentId: string;
  name: string;
}

export interface Subgroup {
  id: string;
  groupId: string;
  name: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: string;
}

export const ProductCatalog: React.FC = () => {
  const { token, activeWarehouseId, hasPermission } = useAuthStore();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<UnitOfMeasureItem[]>([]);
  const [presentationTemplates, setPresentationTemplates] = useState<
    PresentationTemplateItem[]
  >([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedSubgroup, setSelectedSubgroup] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");

  // Modales
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState<boolean>(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState<boolean>(false);
  const [isPresentationModalOpen, setIsPresentationModalOpen] =
    useState<boolean>(false);
  const [isStockLotsModalOpen, setIsStockLotsModalOpen] =
    useState<boolean>(false);
  const [selectedProductForStockLots, setSelectedProductForStockLots] =
    useState<ProductItem | null>(null);

  // Estado del formulario de producto
  const [isEditingProduct, setIsEditingProduct] = useState<boolean>(false);
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);
  const [productTab, setProductTab] = useState<
    "general" | "pricing" | "presentations" | "stock"
  >("general");
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  // Estado del Formulario Producto
  const [productForm, setProductForm] = useState<{
    sku: string;
    barcode: string;
    name: string;
    description: string;
    productType: "physical" | "service" | "kit" | "raw_material";
    tracksInventory: boolean;
    departmentId: string;
    groupId: string;
    subgroupId: string;
    brand: string;
    unitOfMeasure: string;
    costPrice: number;
    basePrice: number;
    currency: "USD" | "VES";
    defaultTaxRateId: string;
    taxInclusive: boolean;
    minStock: number;
    maxStock: number;
    hasBatches: boolean;
    hasSerials: boolean;
    isActive: boolean;
    aisle: string;
    shelf: string;
    compartment: string;
    warehouseId?: string;
    skus: ProductSkuItem[];
    presentations: ProductPresentationItem[];
  }>({
    sku: "",
    barcode: "",
    name: "",
    description: "",
    productType: "physical",
    tracksInventory: true,
    departmentId: "",
    groupId: "",
    subgroupId: "",
    brand: "",
    unitOfMeasure: "UND",
    costPrice: 0,
    basePrice: 0,
    currency: "USD",
    defaultTaxRateId: "",
    taxInclusive: false,
    minStock: 0,
    maxStock: 0,
    hasBatches: false,
    hasSerials: false,
    isActive: true,
    aisle: "",
    shelf: "",
    compartment: "",
    warehouseId: "",
    skus: [],
    presentations: [],
  });

  // Estado Formulario de Marcas
  const [brandForm, setBrandForm] = useState<{
    id?: string;
    name: string;
    description: string;
    isEditing: boolean;
  }>({ name: "", description: "", isEditing: false });
  const [isSavingBrand, setIsSavingBrand] = useState<boolean>(false);

  // Estado Formulario de Unidades
  const [unitForm, setUnitForm] = useState<{
    id?: string;
    code: string;
    name: string;
    symbol: string;
    isEditing: boolean;
  }>({ code: "", name: "", symbol: "", isEditing: false });
  const [isSavingUnit, setIsSavingUnit] = useState<boolean>(false);

  // Estado Formulario de Presentaciones Catálogo
  const [presForm, setPresForm] = useState<{
    id?: string;
    name: string;
    description: string;
    defaultMultiplier: number;
    defaultUnit: string;
    requiresAuthorization?: boolean;
    isEditing: boolean;
  }>({
    name: "",
    description: "",
    defaultMultiplier: 1,
    defaultUnit: "UND",
    requiresAuthorization: false,
    isEditing: false,
  });
  const [isSavingPres, setIsSavingPres] = useState<boolean>(false);

  // Carga de Datos Auxiliares
  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [depRes, grpRes, subRes, brandRes, unitRes, presRes, taxRes] =
        await Promise.all([
          fetch("/api/inventory/departments", { headers }),
          fetch("/api/inventory/groups", { headers }),
          fetch("/api/inventory/subgroups", { headers }),
          fetch("/api/inventory/brands", { headers }),
          fetch("/api/inventory/units", { headers }),
          fetch("/api/inventory/presentations", { headers }),
          fetch("/api/pricing/tax-rates", { headers }),
        ]);

      if (depRes.ok) {
        const j = await depRes.json();
        setDepartments(j.data || []);
      }
      if (grpRes.ok) {
        const j = await grpRes.json();
        setGroups(j.data || []);
      }
      if (subRes.ok) {
        const j = await subRes.json();
        setSubgroups(j.data || []);
      }
      if (brandRes.ok) {
        const j = await brandRes.json();
        setBrands(j.data || []);
      }
      if (unitRes.ok) {
        const j = await unitRes.json();
        setUnitsOfMeasure(j.data || []);
      }
      if (presRes.ok) {
        const j = await presRes.json();
        setPresentationTemplates(j.data || []);
      }
      if (taxRes.ok) {
        const j = await taxRes.json();
        setTaxRates(j.data || []);
      }
    } catch {
      // Ignorar fallas silenciosas en auxiliares
    }
  }, [token]);

  // Carga de Catálogo de Productos
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams();
      if (activeWarehouseId) params.append("warehouseId", activeWarehouseId);
      if (selectedDepartment) params.append("departmentId", selectedDepartment);
      if (selectedGroup) params.append("groupId", selectedGroup);
      if (selectedSubgroup) params.append("subgroupId", selectedSubgroup);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const url = `/api/inventory/products?${params.toString()}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error("No se pudo cargar el catálogo de productos");
      }
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err: any) {
      setError(err.message || "Error al obtener productos");
      toast.error("Error al cargar productos");
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    activeWarehouseId,
    selectedDepartment,
    selectedGroup,
    selectedSubgroup,
    searchTerm,
  ]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filtrado de grupos según departamento seleccionado en formulario
  const availableGroupsInForm = useMemo(() => {
    if (!productForm.departmentId) return [];
    return groups.filter((g) => g.departmentId === productForm.departmentId);
  }, [groups, productForm.departmentId]);

  // Filtrado de subgrupos según grupo seleccionado en formulario
  const availableSubgroupsInForm = useMemo(() => {
    if (!productForm.groupId) return [];
    return subgroups.filter((sg) => sg.groupId === productForm.groupId);
  }, [subgroups, productForm.groupId]);

  // Tasa de impuesto activa seleccionada
  const selectedTaxRateValue = useMemo(() => {
    const rateObj = taxRates.find((t) => t.id === productForm.defaultTaxRateId);
    return rateObj ? Number(rateObj.rate) : 16.0;
  }, [taxRates, productForm.defaultTaxRateId]);

  // PVP Final calculado en tiempo real
  const computedFinalPrice = useMemo(() => {
    const base = productForm.basePrice || 0;
    if (productForm.taxInclusive) return base;
    return Number((base * (1 + selectedTaxRateValue / 100)).toFixed(2));
  }, [productForm.basePrice, productForm.taxInclusive, selectedTaxRateValue]);

  // Abrir Modal para Nuevo Producto
  const handleOpenCreateProduct = () => {
    setIsEditingProduct(false);
    setCurrentProductId(null);
    setProductTab("general");
    const defaultTax = taxRates.find((t) => t.rate === 16)?.id || "";
    setProductForm({
      sku: "",
      barcode: "",
      name: "",
      description: "",
      productType: "physical",
      tracksInventory: true,
      departmentId: departments[0]?.id || "",
      groupId: "",
      subgroupId: "",
      brand: brands[0]?.name || "",
      unitOfMeasure: unitsOfMeasure[0]?.code || "UND",
      costPrice: 0,
      basePrice: 0,
      currency: "USD",
      defaultTaxRateId: defaultTax,
      taxInclusive: false,
      minStock: 5,
      maxStock: 100,
      hasBatches: false,
      hasSerials: false,
      isActive: true,
      aisle: "",
      shelf: "",
      compartment: "",
      warehouseId: activeWarehouseId || "",
      skus: [],
      presentations: [],
    });
    setIsProductModalOpen(true);
  };

  // Abrir Modal para Editar Producto
  const handleOpenEditProduct = async (prodId: string) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/products/${prodId}`, { headers });
      if (!res.ok) throw new Error("No se pudo cargar el producto");
      const json = await res.json();
      const p: ProductItem = json.data;

      setIsEditingProduct(true);
      setCurrentProductId(p.id);
      setProductTab("general");

      const primaryLocation = p.locations?.[0] || {};

      setProductForm({
        sku: p.sku || "",
        barcode: p.barcode || "",
        name: p.name || "",
        description: p.description || "",
        productType: p.productType || "physical",
        tracksInventory: p.tracksInventory !== false,
        departmentId: p.departmentId || "",
        groupId: p.groupId || "",
        subgroupId: p.subgroupId || "",
        brand: p.brand || "",
        unitOfMeasure: p.unitOfMeasure || "UND",
        costPrice: Number(p.costPrice) || 0,
        basePrice: Number(p.basePrice) || 0,
        currency: p.currency || "USD",
        defaultTaxRateId: p.defaultTaxRateId || "",
        taxInclusive: Boolean(p.taxInclusive),
        minStock: Number(p.minStock) || 0,
        maxStock: Number(p.maxStock) || 0,
        hasBatches: Boolean(p.hasBatches),
        hasSerials: Boolean(p.hasSerials),
        isActive: p.isActive !== false,
        aisle: primaryLocation.aisle || p.aisle || "",
        shelf: primaryLocation.shelf || p.shelf || "",
        compartment: primaryLocation.compartment || p.compartment || "",
        warehouseId: primaryLocation.warehouseId || activeWarehouseId || "",
        skus: Array.isArray(p.skus) ? p.skus : [],
        presentations: Array.isArray(p.presentations) ? p.presentations : [],
      });

      setIsProductModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar datos del producto");
    }
  };

  // Guardar Producto (Crear o Actualizar)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.name.trim()) {
      toast.error("El nombre del producto es obligatorio");
      setProductTab("general");
      return;
    }
    if (!productForm.sku.trim()) {
      toast.error("El SKU principal es obligatorio");
      setProductTab("general");
      return;
    }

    setIsSavingProduct(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Sanear y tipar explícitamente los SKUs secundarios
      const cleanSkus = (productForm.skus || [])
        .filter((s) => s.sku && s.sku.trim().length > 0)
        .map((s) => ({
          id: s.id?.trim() || undefined,
          sku: s.sku.trim().toUpperCase(),
          barcode: s.barcode?.trim() || null,
          description: s.description?.trim() || null,
          isPrimary: Boolean(s.isPrimary),
          costPrice:
            s.costPrice != null && !isNaN(Number(s.costPrice))
              ? Number(s.costPrice)
              : null,
          price:
            s.price != null && !isNaN(Number(s.price)) ? Number(s.price) : null,
          currency: s.currency || productForm.currency || "USD",
        }));

      // Sanear y tipar explícitamente las presentaciones y empaques (fuente unificada)
      const cleanPresentations = (productForm.presentations || [])
        .filter((p) => p.name && p.name.trim().length > 0)
        .map((p) => ({
          id: p.id?.trim() || undefined,
          presentationId: p.presentationId?.trim() || null,
          name: p.name.trim(),
          sku: p.sku?.trim().toUpperCase() || null,
          barcode: p.barcode?.trim() || null,
          unitOfMeasure: p.unitOfMeasure?.trim() || "UND",
          multiplier: Number(p.multiplier) > 0 ? Number(p.multiplier) : 1,
          costPrice: Number(p.costPrice) >= 0 ? Number(p.costPrice) : 0,
          basePrice: Number(p.basePrice) >= 0 ? Number(p.basePrice) : 0,
          currency: p.currency || productForm.currency || "USD",
          isDefault: Boolean(p.isDefault),
          isActive: p.isActive !== false,
          requiresAuthorization: Boolean(p.requiresAuthorization),
        }));

      // Armar SKUs alternativos a partir de las presentaciones para máxima coherencia
      const presentationDerivedSkus = cleanPresentations
        .filter((p) => p.sku && p.sku.trim().length > 0)
        .map((p) => ({
          sku: p.sku!.trim().toUpperCase(),
          barcode: p.barcode?.trim() || null,
          description: `${p.name} (x${p.multiplier})`,
          isPrimary: Boolean(p.isDefault),
          costPrice: p.costPrice > 0 ? p.costPrice : null,
          price: p.basePrice > 0 ? p.basePrice : null,
          currency: p.currency || productForm.currency || "USD",
        }));

      const finalSkus =
        cleanSkus.length > 0 ? cleanSkus : presentationDerivedSkus;

      const targetWarehouseId =
        productForm.warehouseId?.trim() || activeWarehouseId?.trim() || null;
      const hasLocationData = Boolean(
        productForm.aisle?.trim() ||
        productForm.shelf?.trim() ||
        productForm.compartment?.trim(),
      );

      const payload = {
        sku: productForm.sku.trim().toUpperCase(),
        barcode: productForm.barcode?.trim() || null,
        name: productForm.name.trim(),
        description: productForm.description?.trim() || null,
        productType: productForm.productType || "physical",
        tracksInventory: Boolean(productForm.tracksInventory),
        departmentId: productForm.departmentId?.trim() || null,
        groupId: productForm.groupId?.trim() || null,
        subgroupId: productForm.subgroupId?.trim() || null,
        brand: productForm.brand?.trim() || null,
        unitOfMeasure: productForm.unitOfMeasure?.trim() || "UND",
        costPrice: Number(productForm.costPrice) || 0,
        basePrice: Number(productForm.basePrice) || 0,
        currency: productForm.currency || "USD",
        defaultTaxRateId: productForm.defaultTaxRateId?.trim() || null,
        taxInclusive: Boolean(productForm.taxInclusive),
        minStock: Number(productForm.minStock) || 0,
        maxStock: Number(productForm.maxStock) || 0,
        hasBatches: Boolean(productForm.hasBatches),
        hasSerials: Boolean(productForm.hasSerials),
        isActive: productForm.isActive !== false,
        skus: finalSkus,
        presentations: cleanPresentations,
        locations:
          targetWarehouseId && hasLocationData
            ? [
                {
                  warehouseId: targetWarehouseId,
                  aisle: productForm.aisle?.trim() || null,
                  shelf: productForm.shelf?.trim() || null,
                  compartment: productForm.compartment?.trim() || null,
                },
              ]
            : undefined,
      };

      const url = isEditingProduct
        ? `/api/inventory/products/${currentProductId}`
        : "/api/inventory/products";
      const method = isEditingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error?.message || json.message || "Error al guardar el producto",
        );
      }

      toast.success(
        isEditingProduct
          ? "Producto actualizado correctamente"
          : "Producto creado exitosamente",
      );
      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar el producto");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Eliminar Producto
  const handleDeleteProduct = async (p: ProductItem) => {
    const confirmed = await showConfirmQuestion({
      title: "¿Eliminar producto?",
      html: `¿Está seguro de eliminar el producto <strong>${p.name}</strong> (${p.sku})?<br/><br/><span class="text-xs text-neutral-500">Si tiene transacciones históricas, se desactivará para resguardar la contabilidad.</span>`,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      isDestructive: true,
      icon: "warning",
    });

    if (!confirmed) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/products/${p.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Error al eliminar producto");
      }

      toast.success(json.message || "Operación procesada con éxito");
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar el producto");
    }
  };

  // Operaciones de SKU en Formulario
  const handleAddSkuRow = () => {
    setProductForm((prev) => ({
      ...prev,
      skus: [
        ...prev.skus,
        {
          sku: `${prev.sku}-ALT${prev.skus.length + 1}`,
          barcode: "",
          description: "SKU Alternativo",
          isPrimary: false,
          costPrice: null,
          price: null,
          currency: prev.currency,
        },
      ],
    }));
  };

  const handleRemoveSkuRow = (index: number) => {
    setProductForm((prev) => ({
      ...prev,
      skus: prev.skus.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdateSkuRow = (
    index: number,
    field: keyof ProductSkuItem,
    val: any,
  ) => {
    setProductForm((prev) => {
      const updated = [...prev.skus];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, skus: updated };
    });
  };

  // Operaciones de Presentaciones en Formulario
  const handleAddPresentationRow = (template?: PresentationTemplateItem) => {
    setProductForm((prev) => ({
      ...prev,
      presentations: [
        ...prev.presentations,
        {
          presentationId: template?.id,
          name: template?.name || `Caja x 12`,
          sku: `${prev.sku}-${(template?.name || "CJ12").slice(0, 4).toUpperCase().replace(/\s+/g, "")}`,
          barcode: "",
          unitOfMeasure: template?.defaultUnit || "CAJA",
          multiplier: template?.defaultMultiplier || 12,
          costPrice: Number(
            (
              (prev.costPrice || 0) * (template?.defaultMultiplier || 12)
            ).toFixed(2),
          ),
          basePrice: Number(
            (
              (prev.basePrice || 0) * (template?.defaultMultiplier || 12)
            ).toFixed(2),
          ),
          currency: prev.currency,
          isDefault: false,
          isActive: true,
          requiresAuthorization: template?.requiresAuthorization ?? false,
        },
      ],
    }));
  };

  const handleRemovePresentationRow = (index: number) => {
    setProductForm((prev) => ({
      ...prev,
      presentations: prev.presentations.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdatePresentationRow = (
    index: number,
    field: keyof ProductPresentationItem,
    val: any,
  ) => {
    setProductForm((prev) => {
      const updated = [...prev.presentations];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, presentations: updated };
    });
  };

  // ==========================================
  // GESTIÓN DE MARCAS (CRUD)
  // ==========================================
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      toast.error("El nombre de la marca es obligatorio");
      return;
    }
    setIsSavingBrand(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const url = brandForm.isEditing
        ? `/api/inventory/brands/${brandForm.id}`
        : "/api/inventory/brands";
      const method = brandForm.isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: brandForm.name.trim(),
          description: brandForm.description.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || "Error al guardar marca");

      toast.success(
        brandForm.isEditing
          ? "Marca actualizada correctamente"
          : "Marca creada exitosamente",
      );
      setBrandForm({ name: "", description: "", isEditing: false });
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar marca");
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleDeleteBrand = async (b: BrandItem) => {
    const ok = await showConfirmQuestion({
      title: "¿Eliminar marca?",
      text: `¿Desea eliminar la marca "${b.name}"?`,
      confirmButtonText: "Eliminar",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/brands/${b.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Error al eliminar");
      toast.success(json.message || "Marca eliminada");
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la marca");
    }
  };

  // ==========================================
  // GESTIÓN DE UNIDADES DE MEDIDA (CRUD)
  // ==========================================
  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.code.trim() || !unitForm.name.trim()) {
      toast.error("Código y nombre de unidad son obligatorios");
      return;
    }
    setIsSavingUnit(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const url = unitForm.isEditing
        ? `/api/inventory/units/${unitForm.id}`
        : "/api/inventory/units";
      const method = unitForm.isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          code: unitForm.code.trim().toUpperCase(),
          name: unitForm.name.trim(),
          symbol: unitForm.symbol.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || "Error al guardar unidad");

      toast.success(
        unitForm.isEditing
          ? "Unidad actualizada correctamente"
          : "Unidad creada exitosamente",
      );
      setUnitForm({ code: "", name: "", symbol: "", isEditing: false });
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar unidad");
    } finally {
      setIsSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (u: UnitOfMeasureItem) => {
    const ok = await showConfirmQuestion({
      title: "¿Eliminar unidad de medida?",
      text: `¿Desea eliminar la unidad "${u.code} - ${u.name}"?`,
      confirmButtonText: "Eliminar",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/units/${u.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Error al eliminar");
      toast.success(json.message || "Unidad eliminada");
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la unidad");
    }
  };

  // ==========================================
  // GESTIÓN DE PRESENTACIONES CATÁLOGO (CRUD)
  // ==========================================
  const handleSavePresTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presForm.name.trim()) {
      toast.error("El nombre de la presentación es requerido");
      return;
    }
    setIsSavingPres(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const url = presForm.isEditing
        ? `/api/inventory/presentations/${presForm.id}`
        : "/api/inventory/presentations";
      const method = presForm.isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: presForm.name.trim(),
          description: presForm.description.trim() || null,
          defaultMultiplier: Number(presForm.defaultMultiplier) || 1,
          defaultUnit: presForm.defaultUnit || "UND",
          requiresAuthorization: Boolean(presForm.requiresAuthorization),
        }),
      });

      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || "Error al guardar presentación");

      toast.success(
        presForm.isEditing
          ? "Presentación actualizada"
          : "Presentación creada exitosamente",
      );
      setPresForm({
        name: "",
        description: "",
        defaultMultiplier: 1,
        defaultUnit: "UND",
        requiresAuthorization: false,
        isEditing: false,
      });
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar presentación");
    } finally {
      setIsSavingPres(false);
    }
  };

  const handleDeletePresTemplate = async (t: PresentationTemplateItem) => {
    const ok = await showConfirmQuestion({
      title: "¿Eliminar plantilla de presentación?",
      text: `¿Desea eliminar la presentación "${t.name}"?`,
      confirmButtonText: "Eliminar",
      isDestructive: true,
    });
    if (!ok) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/inventory/presentations/${t.id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Error al eliminar");
      toast.success(json.message || "Presentación eliminada");
      fetchAuxiliaryData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la presentación");
    }
  };

  // Filtrado reactivo en cliente (para stock y búsqueda rápida)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (stockFilter === "in_stock" && (p.currentStock || 0) <= 0)
        return false;
      if (stockFilter === "out_of_stock" && (p.currentStock || 0) > 0)
        return false;
      if (stockFilter === "low_stock") {
        const min = p.minStock || 5;
        if ((p.currentStock || 0) > min) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchSku = p.sku?.toLowerCase().includes(term);
        const matchName = p.name?.toLowerCase().includes(term);
        const matchBarcode = p.barcode?.toLowerCase().includes(term);
        const matchDept = p.departmentName?.toLowerCase().includes(term);
        const matchBrand = p.brand?.toLowerCase().includes(term);
        if (
          !matchSku &&
          !matchName &&
          !matchBarcode &&
          !matchDept &&
          !matchBrand
        )
          return false;
      }

      return true;
    });
  }, [products, stockFilter, searchTerm]);

  // Endpoint para reporte PDF
  const pdfEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (activeWarehouseId) params.append("warehouseId", activeWarehouseId);
    if (selectedDepartment) params.append("departmentId", selectedDepartment);
    if (selectedGroup) params.append("groupId", selectedGroup);
    if (selectedSubgroup) params.append("subgroupId", selectedSubgroup);
    if (searchTerm.trim()) params.append("search", searchTerm.trim());
    return `/api/inventory/products/pdf?${params.toString()}`;
  }, [
    activeWarehouseId,
    selectedDepartment,
    selectedGroup,
    selectedSubgroup,
    searchTerm,
  ]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    const headers = [
      "SKU",
      "Código de Barras",
      "Producto",
      "Marca",
      "Unidad",
      "Departamento",
      "Grupo",
      "Subgrupo",
      "Costo ($)",
      "Precio Base ($)",
      "Tasa IVA (%)",
      "PVP Final ($)",
      "Stock Actual",
      "SKUs Asociados",
      "Presentaciones",
      "Pasillo",
      "Estante",
      "Compartimiento",
    ];

    const rows = filteredProducts.map((p) => {
      const taxMultiplier = 1 + (p.taxRate || 0) / 100;
      const finalPrice = (p.basePrice || 0) * taxMultiplier;
      return [
        `"${p.sku || ""}"`,
        `"${p.barcode || ""}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.brand || ""}"`,
        `"${p.unitOfMeasure || "UND"}"`,
        `"${p.departmentName || ""}"`,
        `"${p.groupName || ""}"`,
        `"${p.subgroupName || ""}"`,
        (p.costPrice || 0).toFixed(2),
        (p.basePrice || 0).toFixed(2),
        (p.taxRate || 0).toFixed(2),
        finalPrice.toFixed(2),
        p.currentStock || 0,
        p.skusCount || 1,
        p.presentationsCount || 0,
        `"${p.aisle || ""}"`,
        `"${p.shelf || ""}"`,
        `"${p.compartment || ""}"`,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `catalogo_productos_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Archivo CSV exportado exitosamente");
  };

  // Columnas de la DataTable
  const columns: Column<ProductItem>[] = [
    {
      header: "Producto / SKU",
      cell: (row) => {
        return (
          <div>
            <div className="font-semibold text-neutral-400 flex items-center gap-2">
              <span>{row.name}</span>
              {row.brand && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200">
                  {row.brand}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded-lg">
                {row.sku}
              </span>
              {row.barcode && (
                <span className="text-xs font-mono text-neutral-500 bg-neutral-50 px-1 py-0.5 rounded-lg border border-neutral-200">
                  {row.barcode}
                </span>
              )}
              {Number(row.skusCount) > 1 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                  +{Number(row.skusCount) - 1} SKUs
                </span>
              )}
              {Number(row.presentationsCount) > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {row.presentationsCount} Pres.
                </span>
              )}
              {row.hasBatches && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  Lotes & Vence
                </span>
              )}
              {row.tracksInventory === false && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200">
                  Sin control de stock
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Jerarquía / Unidad",
      cell: (row) => (
        <div className="text-xs">
          <div className="font-medium text-neutral-400">
            {row.departmentName || "General"}
            {row.groupName && (
              <span className="text-neutral-500 font-normal">
                {" "}
                › {row.groupName}
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Unidad Base:{" "}
            <span className="font-semibold text-neutral-700">
              {row.unitOfMeasure || "UND"}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Ubicación",
      cell: (row) =>
        row.aisle ? (
          <div className="flex items-center gap-1 text-xs text-neutral-700">
            <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>
              {row.aisle}
              {row.shelf ? ` • ${row.shelf}` : ""}
            </span>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 italic">Sin ubicación</span>
        ),
    },
    {
      header: "Costo ($)",
      accessorKey: "costPrice",
      cell: (row) => (
        <span className="text-xs font-mono text-neutral-600">
          {formatMoneyUSD(row.costPrice || 0)}
        </span>
      ),
    },
    {
      header: "Base ($)",
      accessorKey: "basePrice",
      cell: (row) => (
        <span className="text-xs font-mono text-neutral-400 font-medium">
          {formatMoneyUSD(row.basePrice || 0)}
        </span>
      ),
    },
    {
      header: "IVA",
      cell: (row) => {
        const rate = row.taxRate ?? 16;
        return (
          <Badge variant={rate === 0 ? "neutral" : "info"}>
            {rate === 0 ? "Exento" : `${rate}%`}
          </Badge>
        );
      },
    },
    {
      header: "PVP Final ($)",
      cell: (row) => {
        const rate = row.taxRate ?? 16;
        const finalPrice = (row.basePrice || 0) * (1 + rate / 100);
        return (
          <span className="font-bold text-neutral-400 text-sm">
            {formatMoneyUSD(finalPrice)}
          </span>
        );
      },
    },
    {
      header: "Stock",
      cell: (row) => {
        if (row.tracksInventory === false) {
          return (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              Sin control
            </span>
          );
        }
        const stock = row.currentStock || 0;
        const min = row.minStock || 5;
        let colorClass = "text-neutral-400 font-medium";
        if (stock <= 0) colorClass = "text-red-600 font-bold";
        else if (stock <= min) colorClass = "text-amber-600 font-semibold";

        return (
          <span className={`text-xs ${colorClass}`}>
            {formatNumber(stock, { maximumFractionDigits: 2 })}{" "}
            {row.unitOfMeasure || "UND"}
          </span>
        );
      },
    },
    {
      header: "Acciones",
      cell: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg text-neutral-700 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 text-xs"
            onClick={() => {
              setSelectedProductForStockLots(row);
              setIsStockLotsModalOpen(true);
            }}
            title="Ver existencias por almacén y control de lotes"
          >
            <Warehouse className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Existencias
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="p-0 rounded-lg text-neutral-700 hover:text-sky-700 hover:bg-sky-100/80"
            onClick={() => handleOpenEditProduct(row.id)}
            title="Editar producto y presentaciones"
          >
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="p-0 rounded-lg text-neutral-700 hover:text-red-600 hover:border-red-200 hover:bg-red-100/80"
            onClick={() => handleDeleteProduct(row)}
            title="Eliminar producto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Botonera Superior */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-400 dark:text-neutral-100 tracking-tight">
            Catálogo de Productos e Inventario
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Gestión de artículos, múltiples SKUs, presentaciones con precios
            específicos, marcas y unidades
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Gestión de Marcas */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBrandForm({ name: "", description: "", isEditing: false });
              setIsBrandModalOpen(true);
            }}
            className="rounded-lg"
          >
            <Tag className="w-4 h-4 mr-1.5 text-neutral-600" />
            Marcas ({brands.length})
          </Button>

          {/* Botón Gestión de Unidades */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setUnitForm({ code: "", name: "", symbol: "", isEditing: false });
              setIsUnitModalOpen(true);
            }}
            className="rounded-lg"
          >
            <Scale className="w-4 h-4 mr-1.5 text-neutral-600" />
            Unidades ({unitsOfMeasure.length})
          </Button>

          {/* Botón Catálogo de Presentaciones */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPresForm({
                name: "",
                description: "",
                defaultMultiplier: 1,
                defaultUnit: "UND",
                requiresAuthorization: false,
                isEditing: false,
              });
              setIsPresentationModalOpen(true);
            }}
            className="rounded-lg"
          >
            <Boxes className="w-4 h-4 mr-1.5 text-neutral-600" />
            Presentaciones ({presentationTemplates.length})
          </Button>

          {/* Reporte PDF */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPdfModalOpen(true)}
            disabled={isLoading}
            className="rounded-lg"
          >
            <FileDown className="w-4 h-4 mr-1.5 text-neutral-600" />
            Reporte PDF
          </Button>

          {/* Exportar CSV */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            disabled={isLoading || filteredProducts.length === 0}
            className="rounded-lg"
          >
            <Layers className="w-4 h-4 mr-1.5 text-neutral-600" />
            Exportar CSV
          </Button>

          {/* Nuevo Producto */}
          <Button
            size="sm"
            onClick={handleOpenCreateProduct}
            className="rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Búsqueda */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Buscar Producto / SKU / Marca
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ej: Harina PAN, HAR-01..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Departamento
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setSelectedGroup("");
                setSelectedSubgroup("");
              }}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="">Todos los Departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Grupo
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSelectedSubgroup("");
              }}
              disabled={!selectedDepartment}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
            >
              <option value="">Todos los Grupos</option>
              {groups
                .filter(
                  (g) =>
                    !selectedDepartment ||
                    g.departmentId === selectedDepartment,
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Subgrupo */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Subgrupo
            </label>
            <select
              value={selectedSubgroup}
              onChange={(e) => setSelectedSubgroup(e.target.value)}
              disabled={!selectedGroup}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
            >
              <option value="">Todos los Subgrupos</option>
              {subgroups
                .filter((sg) => !selectedGroup || sg.groupId === selectedGroup)
                .map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Estado de Stock */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Existencia en Depósito
            </label>
            <select
              value={stockFilter}
              onChange={(e: any) => setStockFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-400 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="all">Todas las existencias</option>
              <option value="in_stock">Con Stock Disponible</option>
              <option value="low_stock">Stock Crítico / Mínimo</option>
              <option value="out_of_stock">Agotados (Stock 0)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla de Productos */}
      <DataTable
        data={filteredProducts}
        columns={columns}
        searchPlaceholder="Filtrar en resultados..."
        isLoading={isLoading}
      />

      {/* ======================================================== */}
      {/* MODAL PRINCIPAL: CREAR / EDITAR PRODUCTO COMPLETO       */}
      {/* ======================================================== */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        size="5xl"
        title={isEditingProduct ? "Editar Producto" : "Nuevo Producto"}
        subtitle={
          isEditingProduct
            ? `Modificando ${productForm.name} (${productForm.sku})`
            : "Registro integral de artículo, SKUs, presentaciones y reglas de precio"
        }
        icon={<Package className="w-5 h-5 text-sky-600" />}
        maxWidth="max-w-6xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-neutral-500">
              * Los campos marcados son obligatorios para control contable
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                disabled={isSavingProduct}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="product-form"
                isLoading={isSavingProduct}
              >
                {isEditingProduct ? "Guardar Cambios" : "Crear Producto"}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="product-form"
          onSubmit={handleSaveProduct}
          className="flex flex-col gap-4"
        >
          {/* Barra de Pestañas del Formulario */}
          <div className="flex items-center gap-1 border-b border-neutral-200 pb-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setProductTab("general")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                productTab === "general"
                  ? "bg-sky-50 text-sky-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              1. Datos Generales
            </button>
            <button
              type="button"
              onClick={() => setProductTab("pricing")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                productTab === "pricing"
                  ? "bg-sky-50 text-sky-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              2. Precios & Tributos
            </button>
            <button
              type="button"
              onClick={() => setProductTab("presentations")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                productTab === "presentations"
                  ? "bg-sky-50 text-sky-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span>3. Presentaciones & Empaques (SKUs)</span>
              {productForm.presentations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-800 text-[10px]">
                  {productForm.presentations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setProductTab("stock")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                productTab === "stock"
                  ? "bg-sky-50 text-sky-700 font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              4. Stock & Ubicación
            </button>
          </div>

          {/* PESTAÑA 1: DATOS GENERALES */}
          {productTab === "general" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nombre del Producto *"
                  placeholder="Ej: Harina de Maíz Blanco 1Kg"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  required
                />
                <Input
                  label="SKU Maestro / Principal *"
                  placeholder="Ej: HAR-PAN-01"
                  value={productForm.sku}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      sku: e.target.value.toUpperCase(),
                    })
                  }
                  required
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Código de Barras (EAN-13 / UPC)"
                  placeholder="Ej: 7591234567890"
                  value={productForm.barcode}
                  onChange={(e) =>
                    setProductForm({ ...productForm, barcode: e.target.value })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Tipo de Producto
                  </label>
                  <select
                    value={productForm.productType}
                    onChange={(e: any) => {
                      const newType = e.target.value;
                      setProductForm({
                        ...productForm,
                        productType: newType,
                        tracksInventory:
                          newType === "service"
                            ? false
                            : productForm.tracksInventory,
                      });
                    }}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="physical">Físico / Mercancía</option>
                    <option value="service">Servicio</option>
                    <option value="kit">Kit / Combo</option>
                    <option value="raw_material">Materia Prima</option>
                  </select>
                </div>

                {/* Marca con botón rápido */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700">
                      Marca
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsBrandModalOpen(true)}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    value={productForm.brand}
                    onChange={(e) =>
                      setProductForm({ ...productForm, brand: e.target.value })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Sin marca específica</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Unidad de Medida Base */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700">
                      Unidad de Medida Base
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsUnitModalOpen(true)}
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    value={productForm.unitOfMeasure}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        unitOfMeasure: e.target.value,
                      })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {unitsOfMeasure.map((u) => (
                      <option key={u.id} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Departamento */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Departamento
                  </label>
                  <select
                    value={productForm.departmentId}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        departmentId: e.target.value,
                        groupId: "",
                        subgroupId: "",
                      })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Seleccione Departamento</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grupo */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Grupo
                  </label>
                  <select
                    value={productForm.groupId}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        groupId: e.target.value,
                        subgroupId: "",
                      })
                    }
                    disabled={!productForm.departmentId}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Seleccione Grupo</option>
                    {availableGroupsInForm.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subgrupo y Descripción */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Subgrupo
                  </label>
                  <select
                    value={productForm.subgroupId}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        subgroupId: e.target.value,
                      })
                    }
                    disabled={!productForm.groupId}
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Seleccione Subgrupo (opcional)</option>
                    {availableSubgroupsInForm.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Descripción / Observaciones
                  </label>
                  <input
                    type="text"
                    placeholder="Detalles adicionales del artículo..."
                    value={productForm.description}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Control de Manejo de Inventario */}
              <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${productForm.tracksInventory ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-400 flex items-center gap-2">
                      <span>Control de Inventario / Existencias</span>
                      {productForm.tracksInventory ? (
                        <Badge variant="info">Maneja Inventario</Badge>
                      ) : (
                        <Badge variant="success">Sin Control de Stock</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {productForm.tracksInventory
                        ? "El producto valida existencias disponibles, descuenta stock físico en almacén y asienta movimientos en Kardex."
                        : "El producto se puede vender libremente sin tomar en cuenta la existencia (útil para servicios, preparados, platos, conceptos no inventariables o insumos)."}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={productForm.tracksInventory}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        tracksInventory: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                  <span className="ml-2 text-xs font-semibold text-neutral-700">
                    {productForm.tracksInventory ? "Activo" : "Inactivo"}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: PRECIOS & TRIBUTOS */}
          {productTab === "pricing" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Costo Unitario ($)"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={productForm.costPrice}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      costPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Input
                  label="Precio Base ($) *"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={productForm.basePrice}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      basePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Moneda de Catálogo
                  </label>
                  <select
                    value={productForm.currency}
                    onChange={(e: any) =>
                      setProductForm({
                        ...productForm,
                        currency: e.target.value,
                      })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="USD">USD ($ - Dólar Estadounidense)</option>
                    <option value="VES">VES (Bs. - Bolívares)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Alícuota de IVA (SENIAT)
                  </label>
                  <select
                    value={productForm.defaultTaxRateId}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        defaultTaxRateId: e.target.value,
                      })
                    }
                    className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-400 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {taxRates.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name} ({tr.rate}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="tax-inclusive-toggle"
                    checked={productForm.taxInclusive}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        taxInclusive: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label
                    htmlFor="tax-inclusive-toggle"
                    className="text-xs text-neutral-400 font-medium cursor-pointer"
                  >
                    El Precio Base ya incluye el impuesto (Modalidad Inclusiva)
                  </label>
                </div>
              </div>

              {/* Resumen de Margen y PVP Final */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-neutral-500">
                    PVP Final al Público:
                  </span>
                  <div className="text-xl font-bold text-neutral-400">
                    {formatMoneyUSD(computedFinalPrice)}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-neutral-500">
                    Margen Estimado:
                  </span>
                  <div className="text-sm font-semibold text-neutral-400 font-mono">
                    {productForm.costPrice > 0
                      ? `${(((productForm.basePrice - productForm.costPrice) / productForm.costPrice) * 100).toFixed(1)}% Mark-up`
                      : "Sin costo registrado"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: PRESENTACIONES, EMPAQUES Y SKUs (UNIFICADA) */}
          {productTab === "presentations" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase">
                    Presentaciones, Empaques y Códigos SKU
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Configure las diferentes presentaciones de venta (cajas,
                    bultos, paquetes, displays o SKUs alternativos) con su
                    factor en unidades base, código de barras y precio
                    diferenciado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Selector rápido desde plantillas */}
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const tmpl = presentationTemplates.find(
                        (t) => t.id === e.target.value,
                      );
                      if (tmpl) handleAddPresentationRow(tmpl);
                      e.target.value = "";
                    }}
                    className="h-8 px-2.5 text-xs  text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">+ Añadir desde Plantilla...</option>
                    {presentationTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (x{t.defaultMultiplier})
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddPresentationRow()}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Personalizada
                  </Button>
                </div>
              </div>

              {productForm.presentations.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500">
                  No hay presentaciones adicionales configuradas. El producto se
                  comercializará únicamente por su SKU principal (
                  <strong>{productForm.sku || "Sin asignar"}</strong>) en unidad
                  base (<strong>{productForm.unitOfMeasure}</strong>).
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase  tracking-wider border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">Presentación *</th>
                        <th className="p-2.5">Factor (UND Base)</th>
                        <th className="p-2.5">SKU Presentación</th>
                        <th className="p-2.5">Código de Barras</th>
                        <th className="p-2.5">Precio Base ($) *</th>
                        <th className="p-2.5">PVP Final (IVA)</th>
                        <th className="p-2.5 text-center">Req. Autoriz.</th>
                        <th className="p-2.5 text-center">Predet.</th>
                        <th className="p-2.5 text-center">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 ">
                      {productForm.presentations.map((pres, idx) => {
                        const finalPresPrice = Number(
                          (
                            pres.basePrice *
                            (1 + selectedTaxRateValue / 100)
                          ).toFixed(2),
                        );
                        return (
                          <tr
                            key={idx}
                            className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-600 animate-pulse"
                          >
                            <td className="p-2">
                              <input
                                type="text"
                                value={pres.name}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                placeholder="Ej: Caja x 24"
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                required
                              />
                            </td>
                            <td className="p-2 w-28">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={pres.multiplier}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "multiplier",
                                    parseFloat(e.target.value) || 1,
                                  )
                                }
                                className="w-full h-8 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-end"
                                required
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={pres.sku || ""}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "sku",
                                    e.target.value.toUpperCase(),
                                  )
                                }
                                placeholder="SKU Caja..."
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={pres.barcode || ""}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "barcode",
                                    e.target.value,
                                  )
                                }
                                placeholder="EAN-13 / Barras..."
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                              />
                            </td>
                            <td className="p-2 w-32">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pres.basePrice}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "basePrice",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                                required
                              />
                            </td>
                            <td className="p-2 font-mono font-bold text-neutral-400 w-28">
                              {formatMoneyUSD(finalPresPrice)}
                            </td>
                            <td className="p-2 text-center w-24">
                              <input
                                type="checkbox"
                                checked={Boolean(pres.requiresAuthorization)}
                                onChange={(e) =>
                                  handleUpdatePresentationRow(
                                    idx,
                                    "requiresAuthorization",
                                    e.target.checked,
                                  )
                                }
                                title="Marcar si esta presentación requiere autorización de administrador o supervisor para ser vendida"
                                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center w-24">
                              <input
                                type="checkbox"
                                checked={Boolean(pres.isDefault)}
                                onChange={(e) => {
                                  setProductForm((prev) => ({
                                    ...prev,
                                    presentations: prev.presentations.map(
                                      (it, i) => ({
                                        ...it,
                                        isDefault:
                                          i === idx ? e.target.checked : false,
                                      }),
                                    ),
                                  }));
                                }}
                                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-2 text-center w-16">
                              <button
                                type="button"
                                onClick={() => handleRemovePresentationRow(idx)}
                                className="p-1 text-neutral-400 hover:text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 4: STOCK Y UBICACIÓN FÍSICA */}
          {productTab === "stock" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Stock Mínimo Alerta"
                  type="number"
                  min="0"
                  value={productForm.minStock}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      minStock: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Input
                  label="Stock Máximo Deseado"
                  type="number"
                  min="0"
                  value={productForm.maxStock}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      maxStock: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-neutral-400 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.tracksInventory}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        tracksInventory: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  Controlar Existencias en Inventario
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-400 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.hasBatches}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        hasBatches: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  Manejo de Lotes y Vencimiento
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-400 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.hasSerials}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        hasSerials: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  Manejo de Números de Serie
                </label>
              </div>

              {!productForm.tracksInventory && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    Este producto no maneja control de inventario. Se podrá
                    vender sin validar stock disponible ni requerir existencias
                    en almacén.
                  </span>
                </div>
              )}

              <div className="pt-2">
                <h4 className="text-xs font-bold text-neutral-400 uppercase mb-2">
                  Ubicación Física en Depósito Activo (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Pasillo"
                    placeholder="Ej: Pasillo A1"
                    value={productForm.aisle}
                    onChange={(e) =>
                      setProductForm({ ...productForm, aisle: e.target.value })
                    }
                  />
                  <Input
                    label="Estante / Rack"
                    placeholder="Ej: Estante 03"
                    value={productForm.shelf}
                    onChange={(e) =>
                      setProductForm({ ...productForm, shelf: e.target.value })
                    }
                  />
                  <Input
                    label="Compartimiento / Nivel"
                    placeholder="Ej: Gaveta 02"
                    value={productForm.compartment}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        compartment: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: GESTIÓN DE MARCAS (CRUD)                          */}
      {/* ======================================================== */}
      <Modal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        title="Gestión de Marcas de Productos"
        subtitle="Catálogo de marcas registradas y proveedores de marca"
        icon={<Tag className="w-5 h-5 text-sky-600" />}
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSaveBrand} className="flex flex-col gap-3 p-3 ">
            <span className="text-xs font-bold text-neutral-400">
              {brandForm.isEditing ? "Editar Marca" : "Registrar Nueva Marca"}
            </span>
            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                label="Nombre de Marca *"
                placeholder="Ej: Empresas Polar"
                value={brandForm.name}
                onChange={(e) =>
                  setBrandForm({ ...brandForm, name: e.target.value })
                }
                required
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Input
                label="Descripción (opcional)"
                placeholder="Ej: Alimentos y Bebidas"
                value={brandForm.description}
                onChange={(e) =>
                  setBrandForm({ ...brandForm, description: e.target.value })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {brandForm.isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBrandForm({
                      name: "",
                      description: "",
                      isEditing: false,
                    })
                  }
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" isLoading={isSavingBrand}>
                {brandForm.isEditing ? "Actualizar" : "Agregar Marca"}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-2.5 text-xs hover:bg-neutral-0"
              >
                <div>
                  <span className="font-semibold text-neutral-400">
                    {b.name}
                  </span>
                  {b.description && (
                    <span className="text-neutral-500 ml-2">
                      ({b.description})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setBrandForm({
                        id: b.id,
                        name: b.name,
                        description: b.description || "",
                        isEditing: true,
                      })
                    }
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:border-red-600"
                    onClick={() => handleDeleteBrand(b)}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: GESTIÓN DE UNIDADES DE MEDIDA (CRUD)              */}
      {/* ======================================================== */}
      <Modal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        title="Gestión de Unidades de Medida"
        subtitle="Unidades estándar para inventario, pesaje y volumen (SENIAT)"
        icon={<Scale className="w-5 h-5 text-sky-600" />}
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <form onSubmit={handleSaveUnit} className="flex flex-col gap-3 p-3 ">
            <span className="text-xs font-bold text-neutral-400">
              {unitForm.isEditing ? "Editar Unidad" : "Registrar Nueva Unidad"}
            </span>
            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800 grid grid-cols-3 gap-2">
              <Input
                label="Código *"
                placeholder="Ej: UND, KG"
                value={unitForm.code}
                onChange={(e) =>
                  setUnitForm({
                    ...unitForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                required
              />
              <Input
                label="Nombre *"
                placeholder="Ej: Unidad"
                value={unitForm.name}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, name: e.target.value })
                }
                required
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <Input
                label="Símbolo"
                placeholder="Ej: und, kg"
                value={unitForm.symbol}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, symbol: e.target.value })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {unitForm.isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setUnitForm({
                      code: "",
                      name: "",
                      symbol: "",
                      isEditing: false,
                    })
                  }
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" isLoading={isSavingUnit}>
                {unitForm.isEditing ? "Actualizar" : "Agregar Unidad"}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {unitsOfMeasure.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2.5 text-xs hover:bg-neutral-600"
              >
                <div>
                  <span className="font-mono font-bold text-neutral-400 bg-red-500 px-1.5 py-0.5 rounded-lg mr-2">
                    {u.code}
                  </span>
                  <span className="font-medium text-neutral-400">{u.name}</span>
                  {u.symbol && (
                    <span className="text-neutral-500 ml-1.5">
                      ({u.symbol})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setUnitForm({
                        id: u.id,
                        code: u.code,
                        name: u.name,
                        symbol: u.symbol || "",
                        isEditing: true,
                      })
                    }
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:border-red-300"
                    onClick={() => handleDeleteUnit(u)}
                  >
                    <Trash2 className="w-3 h-3 text-red-500 " />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: CATÁLOGO MAESTRO DE PRESENTACIONES (CRUD)         */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPresentationModalOpen}
        onClose={() => setIsPresentationModalOpen(false)}
        title="Catálogo Maestro de Presentaciones"
        subtitle="Plantillas para empaques (Displays, Cajas, Bultos, Sacos)"
        icon={<Boxes className="w-5 h-5 text-sky-600" />}
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-4">
          <form
            onSubmit={handleSavePresTemplate}
            className="flex flex-col gap-3 p-3"
          >
            <span className="text-xs font-bold text-neutral-400">
              {presForm.isEditing
                ? "Editar Plantilla de Presentación"
                : "Registrar Nueva Plantilla"}
            </span>
            <div className="bg-sky-50/60 dark:bg-sky-950/30 p-4 rounded-lg border border-sky-200 dark:border-sky-800  grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                label="Nombre *"
                placeholder="Ej: Caja x 24"
                value={presForm.name}
                onChange={(e) =>
                  setPresForm({ ...presForm, name: e.target.value })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <Input
                label="Factor Multiplicador *"
                type="number"
                min="0.001"
                step="any"
                value={presForm.defaultMultiplier}
                onChange={(e) =>
                  setPresForm({
                    ...presForm,
                    defaultMultiplier: parseFloat(e.target.value) || 1,
                  })
                }
                className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Unidad de Empaque
                </label>
                <select
                  value={presForm.defaultUnit}
                  onChange={(e) =>
                    setPresForm({ ...presForm, defaultUnit: e.target.value })
                  }
                  className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {unitsOfMeasure.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs text-neutral-400 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={presForm.requiresAuthorization}
                  onChange={(e) =>
                    setPresForm({
                      ...presForm,
                      requiresAuthorization: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>
                  Requiere autorización de administrador o supervisor para ser
                  vendida en caja
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {presForm.isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPresForm({
                      name: "",
                      description: "",
                      defaultMultiplier: 1,
                      defaultUnit: "UND",
                      requiresAuthorization: false,
                      isEditing: false,
                    })
                  }
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" isLoading={isSavingPres}>
                {presForm.isEditing ? "Actualizar" : "Agregar Plantilla"}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {presentationTemplates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2.5 text-xs hover:bg-neutral-600"
              >
                <div>
                  <span className="font-semibold text-neutral-400">
                    {t.name}
                  </span>
                  <span className="text-neutral-500 font-mono text-[11px] ml-2">
                    (Multiplicador: x {formatNumber(t.defaultMultiplier,2)} {t.defaultUnit})
                  </span>
                  {t.requiresAuthorization ? (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                      Req. Autorización
                    </span>
                  ) : (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-lg">
                      No requiere Autorización
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPresForm({
                        id: t.id,
                        name: t.name,
                        description: t.description || "",
                        defaultMultiplier: t.defaultMultiplier,
                        defaultUnit: t.defaultUnit,
                        requiresAuthorization: Boolean(t.requiresAuthorization),
                        isEditing: true,
                      })
                    }
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeletePresTemplate(t)}
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Modal de Existencias por Almacén y Control de Lotes / Vencimientos */}
      <ProductStockLotsModal
        isOpen={isStockLotsModalOpen}
        onClose={() => {
          setIsStockLotsModalOpen(false);
          setSelectedProductForStockLots(null);
        }}
        product={selectedProductForStockLots}
      />

      {/* Visor PDF para Exportación */}
      <PdfViewerModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        endpoint={pdfEndpoint}
        title="Catálogo de Productos e Inventario"
        filename={`catalogo_productos_${new Date().toISOString().slice(0, 10)}.pdf`}
      />
    </div>
  );
};
