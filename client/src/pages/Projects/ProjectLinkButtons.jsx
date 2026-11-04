// GitHub / Live demo / Website buttons for a project's main links
const mainLinks = [
  ["githubUrl", "bi-github", "GitHub"],
  ["demoUrl", "bi-play-circle", "Live demo"],
  ["websiteUrl", "bi-globe", "Website"]
];

export default function ProjectLinkButtons({ project, size = "sm" }) {
  const links = mainLinks.filter(([field]) => project[field]);

  if (links.length === 0) return null;

  return (
    <div className="d-flex flex-wrap gap-2">
      {links.map(([field, icon, label]) => (
        <a
          key={field}
          href={project[field]}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-outline-secondary btn-${size}`}
        >
          <i className={`bi ${icon} me-1`} />
          {label}
        </a>
      ))}
    </div>
  );
}
