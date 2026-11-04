// Read-only stars, or clickable when onChange is given
export default function SkillStars({ rating, onChange, size = "" }) {
  return (
    <span
      className="text-nowrap"
      role={onChange ? "radiogroup" : "img"}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((number) => {
        const icon = (
          <i
            className={`bi ${
              number <= rating
                ? "bi-star-fill text-warning"
                : "bi-star text-secondary"
            } ${size}`}
            aria-hidden="true"
          />
        );

        return onChange ? (
          <button
            key={number}
            type="button"
            className="btn btn-link p-0 me-1 text-decoration-none"
            role="radio"
            aria-checked={number === rating}
            aria-label={`${number} out of 5`}
            onClick={() => onChange(number)}
          >
            {icon}
          </button>
        ) : (
          <span key={number} className="me-1">
            {icon}
          </span>
        );
      })}
    </span>
  );
}
