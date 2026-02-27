import type { Lead } from "@/components/leads/LeadCard";

/** Escape CSV value (handles commas, quotes, newlines) */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Generate CSV content from leads */
export function generateLeadsCsv(leads: Lead[]): string {
  const columns = [
    "Rank",
    "Company Name",
    "Category",
    "Rating",
    "Address",
    "Phone",
    "Website",
    "Hours",
    "Status",
  ];

  const header = columns.join(",");
  const rows = leads
    .sort((a, b) => a.rank - b.rank)
    .map((lead) =>
      [
        lead.rank,
        escapeCsv(lead.name),
        escapeCsv(lead.category),
        lead.rating,
        escapeCsv(lead.address),
        lead.phone ? escapeCsv(lead.phone) : "",
        lead.website ? escapeCsv(lead.website) : "",
        lead.hours ? escapeCsv(lead.hours) : "",
        lead.isNew ? "New" : "Existing",
      ].join(",")
    );

  return [header, ...rows].join("\n");
}

/** Generate full CSV with all lead details (for Final List export) */
export function generateFullLeadsCsv(leads: Lead[]): string {
  const columns = [
    "ID",
    "Rank",
    "Company Name",
    "Category",
    "Rating",
    "Address",
    "Phone",
    "Website",
    "Hours",
    "Email",
    "LinkedIn",
    "Instagram",
    "Contact Person",
    "CRM Status",
    "Enrichment Status",
  ];

  const header = columns.join(",");
  const rows = leads
    .sort((a, b) => a.rank - b.rank)
    .map((lead) =>
      [
        escapeCsv(lead.id),
        lead.rank,
        escapeCsv(lead.name),
        escapeCsv(lead.category),
        lead.rating,
        escapeCsv(lead.address),
        lead.phone ? escapeCsv(lead.phone) : "",
        lead.website ? escapeCsv(lead.website) : "",
        lead.hours ? escapeCsv(lead.hours) : "",
        lead.email ? escapeCsv(lead.email) : "",
        lead.linkedin ? escapeCsv(lead.linkedin) : "",
        lead.instagram ? escapeCsv(lead.instagram) : "",
        lead.contactPerson ? escapeCsv(lead.contactPerson) : "",
        lead.crmStatus ? escapeCsv(lead.crmStatus) : "",
        lead.enrichmentStatus ? escapeCsv(lead.enrichmentStatus) : "",
      ].join(",")
    );

  return [header, ...rows].join("\n");
}

/** Trigger CSV file download (with UTF-8 BOM for Excel compatibility) */
export function downloadCsv(content: string, filename = "leads-export") {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
