export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size }} className="tracking-wider" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "text-amber-500" : "text-stone-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
