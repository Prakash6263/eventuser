"use client";

import { useState, useRef, useEffect } from "react";
import { countryCodes } from "../utils/countryCodes";

export default function CountryCodePicker({ value, onChange, className, style }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  const selected = countryCodes.find((c) => c.code === value) || countryCodes[0];

  const filteredCountries = countryCodes.filter(
    (c) =>
      c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.includes(searchQuery) ||
      c.iso.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="position-relative w-100" ref={dropdownRef}>
      {/* Trigger Button - Shows ONLY the number code (e.g. +91) without short country name/flag */}
      <button
        type="button"
        className={className || "btn bg-white rounded-pill border-light-subtle h_50 px-3 d-flex align-items-center justify-content-center gap-2 w-100 shadow-sm"}
        style={style || {
          border: isOpen ? "2px solid #5b67f1" : "1px solid #e9ecef",
          background: "#f8f9fa",
          transition: "all 0.2s ease-in-out",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="fw-semibold text-dark mx-auto" style={{ fontSize: "15px" }}>
          {selected.code}
        </span>
        <i
          className={`fa-solid fa-chevron-${isOpen ? "up" : "down"} text-muted`}
          style={{ fontSize: "10px" }}
        ></i>
      </button>

      {/* Floating Searchable Dropdown */}
      {isOpen && (
        <div
          className="position-absolute start-0 top-100 mt-2 bg-white rounded-4 shadow-lg border p-2"
          style={{
            zIndex: 1050,
            width: "260px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Search Box */}
          <div className="p-1 mb-2 position-relative">
            <input
              type="text"
              className="form-control form-control-sm rounded-pill ps-4 pe-3 bg-light border-0"
              placeholder="Search country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ fontSize: "13px", height: "36px" }}
            />
            <i
              className="fa-solid fa-magnifying-glass position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
              style={{ fontSize: "12px" }}
            ></i>
          </div>

          {/* Country List */}
          <div
            className="custom-scrollbar"
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              paddingRight: "2px",
            }}
          >
            {filteredCountries.length > 0 ? (
              filteredCountries.map((item, idx) => {
                const isSelected = item.code === value;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="dropdown-item d-flex align-items-center justify-content-between rounded-3 px-3 py-2 mb-1 border-0"
                    style={{
                      backgroundColor: isSelected ? "#eef0ff" : "transparent",
                      color: isSelected ? "#5b67f1" : "#212529",
                      fontWeight: isSelected ? "600" : "400",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "#f8f9fa";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    onClick={() => {
                      onChange(item.code);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <span className="d-flex align-items-center gap-2 text-truncate" style={{ fontSize: "13px" }}>
                      <span className="text-truncate">{item.country}</span>
                    </span>
                    <span
                      className="badge rounded-pill ms-2"
                      style={{
                        backgroundColor: isSelected ? "#5b67f1" : "#f1f3f5",
                        color: isSelected ? "#fff" : "#495057",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {item.code}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-3 text-muted small">No country found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
