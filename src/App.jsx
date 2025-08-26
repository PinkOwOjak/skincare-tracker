import React, { useEffect, useState, useRef } from "react";

// Skincare & Makeup Organizer
// Mobile-friendly, responsive React component with Tailwind CSS
// - Persistent localStorage data (never deleted unless user deletes)
// - Add items by name and/or photo (camera-friendly on mobile)
// - Fields: name, category, buyingDate, expiryDate, openingDate, weight, paoMonths
// - Search, filter, edit, delete
// - Export/Import JSON backup
// - Details dropdown per card shows PAO-based expiry and countdown

export default function SkincareOrganizerApp() {
  const STORAGE_KEY = "skincare_products_v1";
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState({}); // id -> boolean for dropdown
  const fileInputRef = useRef(null);

  const blank = {
    name: "",
    category: "skincare",
    buyingDate: "",
    expiryDate: "",
    openingDate: "",
    weight: "",
    imageData: "",
    paoMonths: "", // e.g., 3, 6, 12
  };

  const [form, setForm] = useState(blank);

  // Load from storage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setProducts(JSON.parse(raw));
      } catch (e) {
        console.error("Failed to parse saved products", e);
      }
    }
  }, []);

  // Save to storage
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
    reader.onload = (e) => {
      setForm((s) => ({ ...s, imageData: e.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function onAddOrUpdate(e) {
    e.preventDefault();
    const payload = {
      id: editingId || String(Date.now()),
      name: form.name.trim() || "(Unnamed product)",
      category: form.category,
      buyingDate: form.buyingDate || null,
      expiryDate: form.expiryDate || null,
      openingDate: form.openingDate || null,
      weight: form.weight || "",
      paoMonths: form.paoMonths || "",
      imageData: form.imageData || "",
      createdAt: editingId ? products.find((p) => p.id === editingId)?.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProducts((prev) => {
      if (editingId) {
        return prev.map((p) => (p.id === editingId ? payload : p));
      } else {
        return [payload, ...prev];
      }
    });

    resetForm();
    setShowForm(false);
  }

  function onEdit(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setForm({
      name: p.name,
      category: p.category,
      buyingDate: p.buyingDate || "",
      expiryDate: p.expiryDate || "",
      openingDate: p.openingDate || "",
      weight: p.weight || "",
      imageData: p.imageData || "",
      paoMonths: p.paoMonths || "",
    });
    setEditingId(id);
    setShowForm(true);
  }

  function onDelete(id) {
    if (!confirm("Delete this product? This will remove it from storage.")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function daysBetween(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const diff = Math.ceil((d - new Date(today.toDateString())) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function addMonths(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // handle month overflow (e.g., adding 1 month to Jan 31)
    if (d.getDate() < day) {
      d.setDate(0); // last day of previous month
    }
    return d;
  }

  function monthsDaysBetween(fromDate, toDate) {
    // returns {months, days} positive or negative
    let from = new Date(fromDate);
    let to = new Date(toDate);
    let sign = 1;
    if (to < from) { const tmp = from; from = to; to = tmp; sign = -1; }
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    let anchor = new Date(from);
    anchor.setMonth(from.getMonth() + months);
    if (anchor > to) {
      months -= 1;
      anchor = new Date(from);
      anchor.setMonth(from.getMonth() + months);
    }
    const days = Math.round((to - anchor) / (1000 * 60 * 60 * 24));
    return { months: months * sign, days: days * sign };
  }

  function paoExpiryDate(openDateStr, paoMonthsStr) {
    if (!openDateStr || !paoMonthsStr) return null;
    const m = parseInt(paoMonthsStr, 10);
    if (!Number.isFinite(m) || m <= 0) return null;
    const open = new Date(openDateStr + "T00:00:00");
    return addMonths(open, m);
  }

  function timeSinceOpening(openDateStr) {
    if (!openDateStr) return null;
    const open = new Date(openDateStr + "T00:00:00");
    const today = new Date();
    const diffMs = today - open;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days;
  }

  function formatDMY(dateStrOrDate) {
    if (!dateStrOrDate) return "—";
    const d = typeof dateStrOrDate === "string" ? new Date(dateStrOrDate + "T00:00:00") : new Date(dateStrOrDate);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skincare_products_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          // Merge by id, preferring imported records
          const map = {};
          products.forEach((p) => (map[p.id] = p));
          data.forEach((p) => (map[p.id] = p));
          const merged = Object.values(map).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
          setProducts(merged);
          alert("Import successful.");
        } else {
          alert("Invalid file format: expected array of products.");
        }
      } catch (err) {
        alert("Failed to import: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  const filtered = products.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-sky-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Skincare & Makeup Organizer</h1>
            <p className="text-xs sm:text-sm text-slate-600">Track buying, expiry, opening dates and weight — images supported. Data saved locally.</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => {
                resetForm();
                setShowForm((s) => !s);
              }}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-2xl shadow hover:brightness-95"
            >
              {showForm ? "Close" : "Add product"}
            </button>

            <div className="bg-white rounded-xl p-2 shadow flex flex-col sm:flex-row gap-2 items-center">
              <label className="text-xs text-slate-500">Import</label>
              <input type="file" accept="application/json" onChange={importJSON} className="text-xs sm:text-sm" />
              <button onClick={exportJSON} className="px-2 sm:px-3 py-1 bg-slate-100 rounded">Export</button>
            </div>
          </div>
        </header>

        {/* Form */}
        {showForm && (
          <form onSubmit={onAddOrUpdate} className="bg-white p-4 sm:p-6 rounded-2xl shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Product name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. The Ordinary Niacinamide Serum"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />

                <label className="block text-sm font-medium text-slate-700 mt-4">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 block w-full sm:w-48 rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="skincare">Skincare</option>
                  <option value="makeup">Makeup</option>
                  <option value="bodycare">Bodycare</option>
                  <option value="haircare">Haircare</option>
                  <option value="other">Other</option>
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="text-sm">Buying date</label>
                    <input type="date" value={form.buyingDate} onChange={(e) => setForm({ ...form, buyingDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm">Expiry date</label>
                    <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm">Opening date</label>
                    <input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700 mt-4">Weight / Volume</label>
                <div className="flex gap-2 mt-1">
                  <input
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    placeholder="e.g. 30 ml / 50 g"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => setForm({ ...form, weight: "" })} className="px-3 py-2 bg-slate-100 rounded text-sm">Clear</button>
                </div>

                <label className="block text-sm font-medium text-slate-700 mt-4">PAO (Period After Opening)</label>
                <div className="flex gap-2 mt-1 items-center">
                  <select
                    value={form.paoMonths}
                    onChange={(e) => setForm({ ...form, paoMonths: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
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

              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-xl bg-slate-50 border flex items-center justify-center overflow-hidden">
                  {form.imageData ? (
                    <img src={form.imageData} alt="preview" className="object-contain w-full h-full" />
                  ) : (
                    <div className="text-center text-slate-400 p-4 text-xs sm:text-sm">
                      No image
                      <br />
                      <span className="text-xs">Upload a photo or enter name only</span>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="text-xs"
                />

                <div className="text-xs sm:text-sm text-slate-500">Tip: You can add a product by typing a name and saving. Image is optional.</div>

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
        <section className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap gap-2 items-center w-full">
            <input
              placeholder="Search by name or category"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 rounded-lg border flex-1 min-w-[160px] text-sm"
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
              <option value="all">All categories</option>
              <option value="skincare">Skincare</option>
              <option value="makeup">Makeup</option>
              <option value="bodycare">Bodycare</option>
              <option value="haircare">Haircare</option>
              <option value="other">Other</option>
            </select>
            <div className="text-xs sm:text-sm text-slate-500">Total: {products.length}</div>
          </div>

          <div className="text-xs sm:text-sm text-slate-500">Showing {filtered.length} item(s)</div>
        </section>

        {/* Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <div className="col-span-full bg-white p-6 rounded-2xl shadow text-center text-slate-500">
              No products yet — add your first product to get started.
            </div>
          )}

          {filtered.map((p) => {
            const daysLeft = daysBetween(p.expiryDate);
            const openedDays = timeSinceOpening(p.openingDate);
            const paoDate = p.openingDate && p.paoMonths ? paoExpiryDate(p.openingDate, p.paoMonths) : null;
            const today = new Date();
            const mdd = paoDate ? monthsDaysBetween(today, paoDate) : null;
            const paoLeftLabel = mdd ? `${Math.max(0, mdd.months)}m ${Math.max(0, mdd.days)}d left` : null;

            return (
              <article key={p.id} className="bg-white rounded-2xl shadow overflow-hidden flex flex-col">
                <div className="h-32 sm:h-44 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {p.imageData ? (
                    <img src={p.imageData} alt={p.name} className="object-contain h-full w-full" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="font-semibold text-sm sm:text-base">{p.name}</div>
                      <div className="text-xs text-slate-400">(no image)</div>
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm sm:text-lg font-semibold truncate" title={p.name}>{p.name}</div>
                      <div className="text-xs text-slate-500">{p.category}</div>
                    </div>
                    <div className="text-right text-[10px] sm:text-xs text-slate-500">
                      <div>Weight: {p.weight || "—"}</div>
                      <div>Added: {new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Compact default view */}
                  <div className="mt-3 text-xs sm:text-sm text-slate-600">
                    <div>Opened: {p.openingDate || "—"} {openedDays !== null && <span className="text-slate-400">({openedDays}d since)</span>}</div>
                    <div>Expiry: {p.expiryDate || "—"} {daysLeft !== null && (
                      <strong className={daysLeft < 0 ? "text-red-600 ml-1" : "text-emerald-600 ml-1"}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d past` : `${daysLeft}d left`}
                      </strong>
                    )}</div>
                  </div>

                  {/* Dropdown details */}
                  <div className="mt-2">
                    <button
                      onClick={() => setExpanded((ex) => ({ ...ex, [p.id]: !ex[p.id] }))}
                      className="text-xs rounded-lg border px-2 py-1"
                    >
                      {expanded[p.id] ? "Hide details" : "Show details"}
                    </button>
                    {expanded[p.id] && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 text-xs sm:text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1">
                          <div><span className="text-slate-500">Opening date:</span> {p.openingDate ? formatDMY(p.openingDate) : "—"}</div>
                          <div><span className="text-slate-500">Expiry date:</span> {p.expiryDate ? formatDMY(p.expiryDate) : "—"}</div>
                          <div><span className="text-slate-500">PAO:</span> {p.paoMonths ? `${p.paoMonths}m` : "—"}</div>
                          <div>
                            <span className="text-slate-500">Expiry (PAO):</span> {paoDate ? `${formatDMY(paoDate)}${paoLeftLabel ? ` (${paoLeftLabel})` : ""}` : "—"}
                          </div>
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

        {/* Spacer for mobile FAB */}
        <div className="h-20 sm:h-0" />

        {/* Footer */}
        <footer className="mt-8 text-center text-xs sm:text-sm text-slate-500">
          Tip: Your data lives in your browser (localStorage). Use <span className="font-medium">Export</span> to back up, and <span className="font-medium">Import</span> to restore.
        </footer>

        {/* Mobile floating Add button */}
        <button
          aria-label="Add product"
          onClick={() => {
            resetForm();
            setShowForm(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="sm:hidden fixed bottom-4 right-4 rounded-full shadow-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white w-14 h-14 text-2xl grid place-items-center"
        >
          +
        </button>
      </div>
    </div>
  );
}
