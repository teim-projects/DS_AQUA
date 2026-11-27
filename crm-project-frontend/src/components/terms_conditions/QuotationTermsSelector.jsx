import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { MdCheckCircle, MdExpandMore, MdChevronRight } from "react-icons/md";
import { getBaseApiUrl } from "../../utils/apiConfig";

/**
 * Reusable Category-Wise Accordion Terms & Conditions Selector
 * Matches AddQuotation.jsx Step 3 behavior:
 * - Fetches /quotation/term-categories/ from Terms Master
 * - Closed accordions by default
 * - Auto-selects default terms when creating a new document (!isEdit)
 * - Reconciles against active master terms
 * - Supports Select All / Deselect All per category and per-term description editing
 */
export default function QuotationTermsSelector({
  selectedTerms = [],
  onChange,
  isEdit = false,
  legacyTermsText = "",
  title = "Terms & Conditions Categories",
  subtitle = "Select applicable categories and customize standard contractual terms",
}) {
  const baseApi = getBaseApiUrl();
  const [termCategories, setTermCategories] = useState([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [openCategories, setOpenCategories] = useState({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedTermsRef = useRef(selectedTerms);
  selectedTermsRef.current = selectedTerms;

  useEffect(() => {
    let isMounted = true;

    const fetchTermCategories = async () => {
      setLoadingTerms(true);
      try {
        const token =
          localStorage.getItem("access") ||
          localStorage.getItem("access_token") ||
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          "";

        const res = await axios.get(`${baseApi}/quotation/term-categories/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!isMounted) return;
        const cats = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setTermCategories(cats);
        setOpenCategories({});

        // Auto-select default terms for new document (only if none pre-populated)
        if (!isEdit && (!selectedTermsRef.current || selectedTermsRef.current.length === 0)) {
          const defaults = [];
          cats.forEach((cat) => {
            if (cat.is_active !== false && cat.terms && Array.isArray(cat.terms)) {
              cat.terms.forEach((term) => {
                const isDef =
                  term.is_default === true ||
                  term.is_default === "true" ||
                  term.is_default == 1;
                if (isDef && term.is_active !== false) {
                  defaults.push({
                    id: term.id,
                    category_id: cat.id,
                    category_name: cat.name,
                    name: term.name,
                    description: term.description,
                  });
                }
              });
            }
          });
          onChangeRef.current?.(defaults);
        }
      } catch (err) {
        console.error("Error loading term categories:", err);
        if (isMounted) setTermCategories([]);
      } finally {
        if (isMounted) setLoadingTerms(false);
      }
    };

    fetchTermCategories();
    return () => {
      isMounted = false;
    };
  }, [baseApi, isEdit]);

  // Dynamically reconcile selectedTerms against active master terms categories
  useEffect(() => {
    if (!termCategories || termCategories.length === 0 || !Array.isArray(selectedTerms) || selectedTerms.length === 0) {
      return;
    }

    const activeMasterMap = new Map();
    termCategories.forEach((cat) => {
      if (cat.is_active !== false && Array.isArray(cat.terms)) {
        cat.terms.forEach((t) => {
          if (t.is_active !== false) {
            if (t.id) activeMasterMap.set(String(t.id), { term: t, cat });
            if (t.name) activeMasterMap.set(t.name.trim().toLowerCase(), { term: t, cat });
          }
        });
      }
    });

    let changed = false;
    const updated = [];
    for (const st of selectedTerms) {
      const matchObj =
        (st.id && activeMasterMap.get(String(st.id))) ||
        (st.name && activeMasterMap.get(st.name.trim().toLowerCase()));
      if (matchObj) {
        const { term: match, cat } = matchObj;
        const newDesc = match.description !== undefined ? match.description : st.description;
        if (newDesc !== st.description || match.name !== st.name) {
          changed = true;
        }
        updated.push({
          ...st,
          id: match.id || st.id,
          category_id: cat.id || st.category_id,
          category_name: cat.name || st.category_name,
          name: match.name || st.name,
          description: newDesc,
        });
      } else {
        changed = true;
      }
    }

    if (changed) {
      onChangeRef.current?.(updated);
    }
  }, [termCategories]);

  const toggleCategoryAccordion = (catId) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const isTermSelected = (termId, catName, termName) => {
    return (selectedTerms || []).some(
      (st) =>
        st.id === termId ||
        (st.id !== undefined && termId !== undefined && Number(st.id) === Number(termId)) ||
        (st.category_name === catName && st.name === termName)
    );
  };

  const toggleTerm = (term, category) => {
    const selected = isTermSelected(term.id, category.name, term.name);
    if (selected) {
      onChange(
        (selectedTerms || []).filter(
          (st) =>
            !(
              st.id === term.id ||
              (st.id !== undefined && term.id !== undefined && Number(st.id) === Number(term.id)) ||
              (st.category_name === category.name && st.name === term.name)
            )
        )
      );
    } else {
      onChange([
        ...(selectedTerms || []),
        {
          id: term.id,
          category_id: category.id,
          category_name: category.name,
          name: term.name,
          description: term.description,
        },
      ]);
    }
  };

  const toggleAllCategoryTerms = (category) => {
    const activeTerms = (category.terms || []).filter((t) => t.is_active !== false);
    const allSelected =
      activeTerms.length > 0 &&
      activeTerms.every((t) => isTermSelected(t.id, category.name, t.name));

    if (allSelected) {
      onChange(
        (selectedTerms || []).filter(
          (st) => !(st.category_id === category.id || st.category_name === category.name)
        )
      );
    } else {
      const existingOtherCats = (selectedTerms || []).filter(
        (st) => !(st.category_id === category.id || st.category_name === category.name)
      );
      const newCatTerms = activeTerms.map((t) => ({
        id: t.id,
        category_id: category.id,
        category_name: category.name,
        name: t.name,
        description: t.description,
      }));
      onChange([...existingOtherCats, ...newCatTerms]);
    }
  };

  const updateTermDescription = (termId, catName, termName, newDesc) => {
    onChange(
      (selectedTerms || []).map((st) => {
        if (
          st.id === termId ||
          (st.id !== undefined && termId !== undefined && Number(st.id) === Number(termId)) ||
          (st.category_name === catName && st.name === termName)
        ) {
          return { ...st, description: newDesc };
        }
        return st;
      })
    );
  };

  const activeCategories = termCategories.filter((cat) => cat.is_active !== false);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {title}
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1 shrink-0">
          <MdCheckCircle size={14} /> {(selectedTerms || []).length} Selected
        </span>
      </div>

      {isEdit && (!selectedTerms || selectedTerms.length === 0) && legacyTermsText && (
        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800">
          <span className="font-bold">Legacy Terms on Record:</span> {legacyTermsText}
          <span className="block text-[10px] text-amber-700 mt-0.5">
            Select categories below to switch this document to Quotation Terms &amp; Conditions.
          </span>
        </div>
      )}

      {loadingTerms ? (
        <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
          Loading Terms Categories...
        </div>
      ) : activeCategories.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
          No Terms &amp; Conditions categories found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeCategories.map((cat) => {
            const catTerms = cat.terms || [];
            const activeCatTerms = catTerms.filter((t) => t.is_active !== false);
            const selectedInCat = (selectedTerms || []).filter(
              (t) => t.category_id === cat.id || t.category_name === cat.name
            );
            const allSelected =
              activeCatTerms.length > 0 &&
              activeCatTerms.every((t) => isTermSelected(t.id, cat.name, t.name));

            const isOpen = !!openCategories[cat.id];

            return (
              <div
                key={cat.id}
                className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleCategoryAccordion(cat.id)}
                  className="bg-slate-50/80 hover:bg-slate-100/80 px-3.5 py-2 flex justify-between items-center cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <MdExpandMore size={18} className="text-slate-500" />
                    ) : (
                      <MdChevronRight size={18} className="text-slate-500" />
                    )}
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {cat.name}
                    </h5>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedInCat.length} / {activeCatTerms.length} Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAllCategoryTerms(cat)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                </div>

                {/* Collapsible Terms List */}
                {isOpen && (
                  <div className="p-3.5 space-y-3 divide-y divide-slate-100 border-t border-slate-200">
                    {activeCatTerms.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No terms in this category.
                      </p>
                    ) : (
                      activeCatTerms.map((term) => {
                        const selected = isTermSelected(term.id, cat.name, term.name);
                        const selectedItem = (selectedTerms || []).find(
                          (st) =>
                            st.id === term.id ||
                            (st.id !== undefined &&
                              term.id !== undefined &&
                              Number(st.id) === Number(term.id)) ||
                            (st.category_name === cat.name && st.name === term.name)
                        );

                        return (
                          <div
                            key={term.id}
                            className="pt-2.5 first:pt-0 flex items-start gap-3"
                          >
                            <input
                              type="checkbox"
                              id={`doc-term-${term.id}`}
                              checked={selected}
                              onChange={() => toggleTerm(term, cat)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                              <label
                                htmlFor={`doc-term-${term.id}`}
                                className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-2"
                              >
                                {term.name}
                                {term.is_default && (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded border border-emerald-100 font-medium">
                                    Default
                                  </span>
                                )}
                              </label>
                              {selected ? (
                                <textarea
                                  rows={2}
                                  value={selectedItem?.description ?? term.description}
                                  onChange={(e) =>
                                    updateTermDescription(
                                      term.id,
                                      cat.name,
                                      term.name,
                                      e.target.value
                                    )
                                  }
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                                />
                              ) : (
                                <p className="text-xs text-slate-500 leading-relaxed">
                                  {term.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
