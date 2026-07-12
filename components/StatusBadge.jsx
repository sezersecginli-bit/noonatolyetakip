const STYLES = {
  gelmedi: "bg-line text-ink/50",
  icerde: "bg-brand-light text-brand-dark",
  cikti: "bg-amber-light text-amber",
  izinli: "bg-blue-100 text-blue-700",
};

const LABELS = {
  gelmedi: "Gelmedi",
  icerde: "İçeride",
  cikti: "Çıktı",
  izinli: "İzinli",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
