import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = "skincare_products_v2";

export default function App() {
  // ---------- State ----------
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [mainCategoryFilter, setMainCategoryFilter] = useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const blank = {
    productName: "",
    brandName: "",
    mainCategory: "skincare",
    subCategory: "skincare",
    expiryDate: "",
    manufacturingDate: "",
    openingDate: "",
    weight: "",
    paoMonths: "",
    price: "",
    imageData: "",
  };

  const [form, setForm] = useState(blank);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const importInputRef = useRef(null);

  // ---------- Import/Export ----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skincare_products.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          setProducts(data);
          alert("Import successful!");
        } else {
          alert("Invalid JSON format");
        }
      } catch {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ---------- Helpers ----------
  function addMonths(date, months) {
    const d = new Date(date);
    if (isNaN(d)) return null;
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0);
    return d;
  }

  function daysBetween(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return null;
    const today = new Date();
    const diff = Math.ceil((d - new Date(today.toDateString())) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function monthsDaysBetween(fromDate, toDate) {
    let from = new Date(fromDate);
    let to = new Date(toDate);
    if (isNaN(from) || isNaN(to)) return null;
    let sign = 1;
    if (to < from) { const tmp = from; from = to; to = tmp; sign = -1; }
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    let anchor = new Date(from);
    anchor.setMonth(from.getMonth() + months);
    if (anchor > to) { months -= 1; anchor = new Date(from); anchor.setMonth(from.getMonth() + months); }
    const days = Math.round((to - anchor) / (1000 * 60 * 60 * 24));
    return { months: months * sign, days: days * sign };
  }

  function paoExpiryDate(openDateStr, paoMonthsStr) {
    if (!openDateStr || !paoMonthsStr) return null;
    const m = parseInt(paoMonthsStr, 10);
    if (!Number.isFinite(m) || m <= 0) return null;
    const open = new Date(openDateStr + "T00:00:00");
    if (isNaN(open)) return null;
    return addMonths(open, m);
  }

  function timeSinceOpening(openDateStr) {
    if (!openDateStr) return null;
    const open = new Date(openDateStr + "T00:00:00");
    if (isNaN(open)) return null;
    const today = new Date();
    const diffMs = today - open;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function formatDMY(dateStrOrDate) {
    if (!dateStrOrDate) return "—";
    const d = typeof dateStrOrDate === "string" ? new Date(dateStrOrDate + "T00:00:00") : new Date(dateStrOrDate);
    if (isNaN(d)) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatTimeLeft(dateStr) {
    if (!dateStr) return null;
    const targetDate = new Date(dateStr + "T00:00:00");
    if (isNaN(targetDate)) return null;
    
    const today = new Date();
    const diffMs = targetDate - today;
    const isPast = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    
    const totalDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;
    
    let result = "";
    if (years > 0) result += `${years}y `;
    if (months > 0) result += `${months}m `;
    if (days > 0 || result === "") result += `${days}d`;
    
    return isPast ? `${result.trim()} past` : `${result.trim()} left`;
  }

  function computeEffectiveExpiry(p) {
    // Priority: explicit expiryDate -> PAO(opening + pao) -> null
    if (p.expiryDate) return new Date(p.expiryDate + "T00:00:00");
    const pao = paoExpiryDate(p.openingDate, p.paoMonths);
    return pao || null;
  }

  // ---------- Storage (with migration) ----------
  useEffect(() => {
    // v1 -> v2 migration: map name->productName, add missing fields
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      try { setProducts(JSON.parse(rawV2)); return; } catch {}
    }
    // try migrate from old key
    const rawV1 = localStorage.getItem("skincare_products_v1");
    if (rawV1) {
      try {
        const prev = JSON.parse(rawV1);
        const migrated = prev.map((p) => ({
          id: p.id || String(Date.now()),
          productName: p.name || "(Unnamed product)",
          brandName: "",
          mainCategory: p.category === "makeup" ? "makeup" : (p.category === "other" ? "skincare" : "skincare"),
          subCategory: (p.category === "makeup" || p.category === "other") ? "skincare" : (p.category || "skincare"),
          buyingDate: p.buyingDate || "",
          expiryDate: p.expiryDate || "",
          manufacturingDate: "",
          openingDate: p.openingDate || "",
          weight: p.weight || "",
          paoMonths: p.paoMonths || "",
          price: "",
          imageData: p.imageData || "",
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        }));
        setProducts(migrated);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  function resetForm() {
    setForm(blank);
    setEditingId(null);
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setForm((s) => ({ ...s, imageData: e.target.result }));
    reader.readAsDataURL(file);
  }

  function onAddOrUpdate(e) {
    e.preventDefault();
    const payload = {
      id: editingId || String(Date.now()),
      productName: form.productName.trim() || "(Unnamed product)",
      brandName: form.brandName.trim(),
      mainCategory: form.mainCategory,
      subCategory: form.mainCategory === "skincare" ? form.subCategory : "",
      expiryDate: form.expiryDate || "",
      manufacturingDate: form.manufacturingDate || "",
      openingDate: form.openingDate || "",
      weight: form.weight || "",
      paoMonths: form.paoMonths || "",
      price: form.price || "",
      imageData: form.imageData || "",
      createdAt: editingId ? products.find((p) => p.id === editingId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => editingId ? prev.map((p) => (p.id === editingId ? payload : p)) : [payload, ...prev]);
    resetForm();
    setShowForm(false);
  }

  function onEdit(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setForm({
      productName: p.productName || "",
      brandName: p.brandName || "",
      mainCategory: p.mainCategory || "skincare",
      subCategory: p.subCategory || "skincare",
      expiryDate: p.expiryDate || "",
      manufacturingDate: p.manufacturingDate || "",
      openingDate: p.openingDate || "",
      weight: p.weight || "",
      paoMonths: p.paoMonths || "",
      price: p.price || "",
      imageData: p.imageData || "",
    });
    setEditingId(id);
    setShowForm(true);
  }

  function onDelete(id) {
    if (!confirm("Delete this product? This will remove it from storage.")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  // ---------- Filtering + Sorting ----------
  const filtered = products.filter((p) => {
    // main category filter
    if (mainCategoryFilter !== "all") {
      if (p.mainCategory !== mainCategoryFilter) return false;
      // when skincare and sub filter active
      if (mainCategoryFilter === "skincare" && subCategoryFilter !== "all") {
        if (p.subCategory !== subCategoryFilter) return false;
      }
    }
    // query
    if (query) {
      const q = query.toLowerCase();
      const hay = `${p.productName} ${p.brandName} ${p.mainCategory} ${p.subCategory}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  })
  .sort((a, b) => {
    const ea = computeEffectiveExpiry(a);
    const eb = computeEffectiveExpiry(b);
    if (!ea && !eb) return 0;
    if (!ea) return 1; // a goes after b
    if (!eb) return -1;
    return ea - eb; // soonest first
  });

  const totalInScope = products.filter((p) => {
    if (mainCategoryFilter === "all") return true;
    if (p.mainCategory !== mainCategoryFilter) return false;
    if (mainCategoryFilter === "skincare" && subCategoryFilter !== "all") {
      return p.subCategory === subCategoryFilter;
    }
    return true;
  }).length;

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-sky-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Import/Export in corners - only show when form is not visible */}
        {!showForm && (
          <>
            <div className="fixed top-4 left-4 z-10">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={importJSON}
                className="hidden"
              />
              <button 
                onClick={() => importInputRef.current?.click()}
                className="bg-white px-3 py-2 rounded-xl shadow text-sm border hover:bg-gray-50 text-gray-700"
                title="Import from JSON"
              >
                Import
              </button>
            </div>
            
            <div className="fixed top-4 right-4 z-10">
              <button 
                onClick={exportJSON} 
                className="bg-white px-3 py-2 rounded-xl shadow text-sm border hover:bg-gray-50 text-gray-700"
                title="Export to JSON"
              >
                Export
              </button>
            </div>
          </>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={onAddOrUpdate} className="bg-white p-4 sm:p-6 rounded-2xl shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Brand name</label>
                <input
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="e.g. The Ordinary"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                />

                <label className="block text-sm font-medium text-slate-700 mt-4">Product name</label>
                <input
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="e.g. Niacinamide 10% + Zinc 1%"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Category</label>
                    <select
                      value={form.mainCategory}
                      onChange={(e) => setForm({ ...form, mainCategory: e.target.value, subCategory: e.target.value === 'skincare' ? form.subCategory : '' })}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="skincare">Skincare</option>
                      <option value="makeup">Makeup</option>
                      <option value="perfume">Perfume</option>
                    </select>
                  </div>
                  {form.mainCategory === "skincare" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Subcategory</label>
                      <select
                        value={form.subCategory}
                        onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                        className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                      >
                        <option value="skincare">Skincare</option>
                        <option value="haircare">Haircare</option>
                        <option value="bodycare">Bodycare</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="text-sm">Expiry date (label)</label>
                    <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm">Opening date</label>
                    <input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="text-sm">Manufacturing date</label>
                    <input type="date" value={form.manufacturingDate} onChange={(e) => setForm({ ...form, manufacturingDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm">Weight / Volume</label>
                    <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 30 ml / 50 g" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm">Price</label>
                    <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 10 $" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700 mt-4">PAO (Period After Opening)</label>
                <div className="flex gap-2 mt-1 items-center">
                  <select value={form.paoMonths} onChange={(e) => setForm({ ...form, paoMonths: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Not set</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="9">9 months</option>
                    <option value="12">12 months</option>
                    <option value="18">18 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </select>
                  <span className="text-xs text-slate-500">Used to calculate PAO-based expiry from Opening date</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-4">
                {form.imageData && (
                  <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-xl bg-slate-50 border flex items-center justify-center overflow-hidden">
                    <img src={form.imageData} alt="preview" className="object-contain w-full h-full" />
                  </div>
                )}

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />

                {/* Photo action buttons */}
                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg hover:brightness-95 flex items-center justify-center gap-2"
                  >
                    📷 Take Photo
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg hover:brightness-95 flex items-center justify-center gap-2"
                  >
                    🖼️ Choose from Gallery
                  </button>
                </div>
                
                {form.imageData && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageData: "" })}
                    className="text-sm px-3 py-2 bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    Remove Photo
                  </button>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-3 sm:px-4 py-2 rounded-2xl text-sm" type="submit">
                    {editingId ? "Save changes" : "Add product"}
                  </button>
                  <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="px-3 sm:px-4 py-2 rounded-2xl border text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Toolbar */}
        <section className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-16">{/* Added top margin for fixed buttons */}
          <div className="flex flex-wrap gap-2 items-center w-full">
            <input placeholder="Search by name, brand, category" value={query} onChange={(e) => setQuery(e.target.value)} className="px-3 py-2 rounded-lg border flex-1 min-w-[160px] text-sm" />

            <select value={mainCategoryFilter} onChange={(e) => { setMainCategoryFilter(e.target.value); setSubCategoryFilter("all"); }} className="px-3 py-2 rounded-lg border text-sm">
              <option value="all">All</option>
              <option value="skincare">Skincare</option>
              <option value="makeup">Makeup</option>
              <option value="perfume">Perfume</option>
            </select>

            {mainCategoryFilter === "skincare" && (
              <select value={subCategoryFilter} onChange={(e) => setSubCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
                <option value="all">All skincare</option>
                <option value="skincare">Skincare</option>
                <option value="haircare">Haircare</option>
                <option value="bodycare">Bodycare</option>
              </select>
            )}

            <div className="text-xs sm:text-sm text-slate-500">Total: {totalInScope}</div>
          </div>

          <div className="text-xs sm:text-sm text-slate-500">Showing {filtered.length} item(s)</div>
        </section>

        {/* Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <div className="col-span-full bg-white p-6 rounded-2xl shadow text-center text-slate-500">No products yet — add your first product to get started.</div>
          )}

          {filtered.map((p) => {
            const daysLeft = daysBetween(p.expiryDate);
            const openedDays = timeSinceOpening(p.openingDate);
            const paoDate = p.openingDate && p.paoMonths ? paoExpiryDate(p.openingDate, p.paoMonths) : null;
            const today = new Date();
            const mdd = paoDate ? monthsDaysBetween(today, paoDate) : null;
            
            // Use new formatting for time left
            const expiryTimeLeft = p.expiryDate ? formatTimeLeft(p.expiryDate) : null;
            const paoTimeLeft = paoDate ? formatTimeLeft(formatDMY(paoDate).split('/').reverse().join('-')) : null;

            const titleLine = [p.brandName, p.productName].filter(Boolean).join(" — ");
            const catLine = p.mainCategory === 'skincare' ? `${p.mainCategory}/${p.subCategory}` : p.mainCategory;

            return (
              <article key={p.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                {p.imageData && (
                  <div className="h-32 sm:h-44 bg-slate-50 flex items-center justify-center overflow-hidden">
                    <img src={p.imageData} alt={titleLine} className="object-contain h-full w-full" />
                  </div>
                )}

                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-lg font-semibold truncate" title={titleLine}>{titleLine || "(Unnamed product)"}</div>
                      <div className="text-xs text-slate-500">{catLine}</div>
                    </div>
                    <div className="text-right text-[10px] sm:text-xs text-slate-500">
                      {p.weight && <div>Weight: {p.weight}</div>}
                      <div>Added: {formatDMY(new Date(p.createdAt).toISOString().split('T')[0])}</div>
                    </div>
                  </div>

                  {/* Compact default view */}
                  <div className="mt-3 text-xs sm:text-sm text-slate-600">
                    <div>Opened: {p.openingDate ? formatDMY(p.openingDate) : "—"} {openedDays !== null && <span className="text-slate-400">({openedDays}d since)</span>}</div>
                    <div>Expiry: {p.expiryDate ? formatDMY(p.expiryDate) : (paoDate ? formatDMY(paoDate) : "—")} {(expiryTimeLeft || paoTimeLeft) && (
                      <strong className={(expiryTimeLeft || paoTimeLeft)?.includes('past') ? "text-red-600 ml-1" : "text-emerald-600 ml-1"}>
                        {expiryTimeLeft || paoTimeLeft}
                      </strong>
                    )}</div>
                  </div>

                  {/* Dropdown details */}
                  <div className="mt-2">
                    <button onClick={() => setExpanded((ex) => ({ ...ex, [p.id]: !ex[p.id] }))} className="text-xs rounded-lg border px-2 py-1">
                      {expanded[p.id] ? "Hide details" : "Show details"}
                    </button>
                    {expanded[p.id] && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 text-xs sm:text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1">
                          {p.brandName && <div><span className="text-slate-500">Brand:</span> {p.brandName}</div>}
                          <div><span className="text-slate-500">Product:</span> {p.productName || "—"}</div>
                          {p.price && <div><span className="text-slate-500">Price:</span> {p.price}</div>}
                          <div><span className="text-slate-500">Category:</span> {p.mainCategory}{p.mainCategory==='skincare' && p.subCategory ? ` / ${p.subCategory}` : ""}</div>
                          {/* Show manufacturing date only if provided AND explicit expiry is not provided */}
                          {p.manufacturingDate && !p.expiryDate && (
                            <div><span className="text-slate-500">Manufactured:</span> {formatDMY(p.manufacturingDate)}</div>
                          )}
                          {p.openingDate && <div><span className="text-slate-500">Opened:</span> {formatDMY(p.openingDate)}</div>}
                          {p.expiryDate && <div><span className="text-slate-500">Expiry (label):</span> {formatDMY(p.expiryDate)}</div>}
                          {p.paoMonths && p.openingDate && (
                            <div><span className="text-slate-500">Expiry (PAO):</span> {formatDMY(paoDate)}{paoTimeLeft ? ` (${paoTimeLeft})` : ""}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => onEdit(p.id)} className="flex-1 py-2 rounded-lg border text-xs sm:text-sm">Edit</button>
                    <button onClick={() => onDelete(p.id)} className="py-2 px-3 rounded-lg bg-red-50 text-red-600 text-xs sm:text-sm">Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="h-20 sm:h-0" />
        <footer className="mt-8 text-center text-xs sm:text-sm text-slate-500">
          Tip: Your data lives in your browser (localStorage). Use <span className="font-medium">Export</span> to back up, and <span className="font-medium">Import</span> to restore.
        </footer>

        {/* Dynamic floating button - Add or Back */}
        <button 
          aria-label={showForm ? "Go back" : "Add product"} 
          onClick={() => {
            if (showForm) {
              // Go back to main page
              resetForm();
              setShowForm(false);
            } else {
              // Go to add product form
              resetForm();
              setShowForm(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }} 
          className={`sm:hidden fixed bottom-4 right-4 rounded-full shadow-lg text-white w-14 h-14 text-2xl grid place-items-center transition-all duration-200 ${
            showForm 
              ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700' 
              : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600'
          }`}
        >
          {showForm ? '←' : '+'}
        </button>
      </div>
    </div>
  );
}
