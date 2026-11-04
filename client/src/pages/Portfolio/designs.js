import MonoPortfolio from "./MonoPortfolio";
import MidnightPortfolio from "./MidnightPortfolio";
import EditorialPortfolio from "./EditorialPortfolio";
import FreshPortfolio from "./FreshPortfolio";
import TerminalPortfolio from "./TerminalPortfolio";
import AuroraPortfolio from "./designs/AuroraPortfolio";
import BrutalPortfolio from "./designs/BrutalPortfolio";
import BentoPortfolio from "./designs/BentoPortfolio";
import SwissPortfolio from "./designs/SwissPortfolio";
import SidebarPortfolio from "./designs/SidebarPortfolio";
import NeonPortfolio from "./designs/NeonPortfolio";
import NotebookPortfolio from "./designs/NotebookPortfolio";
import EssayPortfolio from "./designs/EssayPortfolio";
import TimelinePortfolio from "./designs/TimelinePortfolio";
import ExecutivePortfolio from "./designs/ExecutivePortfolio";
import RetroPortfolio from "./designs/RetroPortfolio";
import StudioPortfolio from "./designs/StudioPortfolio";
import SplitPortfolio from "./designs/SplitPortfolio";
import ResumePortfolio from "./designs/ResumePortfolio";
import BlueprintPortfolio from "./designs/BlueprintPortfolio";
import ZenPortfolio from "./designs/ZenPortfolio";
import GazettePortfolio from "./designs/GazettePortfolio";
import PolaroidPortfolio from "./designs/PolaroidPortfolio";
import ArcadePortfolio from "./designs/ArcadePortfolio";
import CosmosPortfolio from "./designs/CosmosPortfolio";
import LedgerPortfolio from "./designs/LedgerPortfolio";
import BoardingPortfolio from "./designs/BoardingPortfolio";
import MetroPortfolio from "./designs/MetroPortfolio";
import MuseumPortfolio from "./designs/MuseumPortfolio";
import VinylPortfolio from "./designs/VinylPortfolio";
import BotanicalPortfolio from "./designs/BotanicalPortfolio";
import MemphisPortfolio from "./designs/MemphisPortfolio";
import LaunchPortfolio from "./designs/LaunchPortfolio";
import DossierPortfolio from "./designs/DossierPortfolio";
import NoirPortfolio from "./designs/NoirPortfolio";
import CandyPortfolio from "./designs/CandyPortfolio";
import CircuitPortfolio from "./designs/CircuitPortfolio";
import IdePortfolio from "./designs/IdePortfolio";
import AtlasPortfolio from "./designs/AtlasPortfolio";
import SlatePortfolio from "./designs/SlatePortfolio";

// The portfolio designs, in gallery order. Every one has a light and a dark
// mode; `tags` drive the gallery filter.
export const DESIGNS = [
  { id: "mono", name: "Mono", tagline: "Minimal monochrome with a bold outlined name", tags: ["Minimal"], Component: MonoPortfolio },
  { id: "midnight", name: "Midnight", tagline: "Glowing gradients and glass cards", tags: ["Creative"], Component: MidnightPortfolio },
  { id: "editorial", name: "Editorial", tagline: "A magazine spread with serif type and pull quotes", tags: ["Classic"], Component: EditorialPortfolio },
  { id: "fresh", name: "Fresh", tagline: "Friendly lime accents and rounded cards", tags: ["Playful"], Component: FreshPortfolio },
  { id: "terminal", name: "Terminal", tagline: "A terminal hero, skills tree and git-log career", tags: ["Developer"], Component: TerminalPortfolio },
  { id: "aurora", name: "Aurora", tagline: "Soft aurora light, gradient type and frosted glass", tags: ["Creative"], Component: AuroraPortfolio },
  { id: "brutal", name: "Brutal", tagline: "Neo-brutalism: thick outlines and sticker colors", tags: ["Playful"], Component: BrutalPortfolio },
  { id: "bento", name: "Bento", tagline: "An Apple-style grid of rounded tiles", tags: ["Minimal"], Component: BentoPortfolio },
  { id: "swiss", name: "Swiss", tagline: "Strict grid, one red, huge lowercase type", tags: ["Minimal", "Classic"], Component: SwissPortfolio },
  { id: "sidebar", name: "Sidebar", tagline: "A sticky profile card beside your sections", tags: ["Developer", "Professional"], Component: SidebarPortfolio },
  { id: "neon", name: "Neon", tagline: "Synthwave sun, neon grid and glowing type", tags: ["Creative", "Playful"], Component: NeonPortfolio },
  { id: "notebook", name: "Notebook", tagline: "Ruled paper, sticky notes and handwriting", tags: ["Playful"], Component: NotebookPortfolio },
  { id: "essay", name: "Essay", tagline: "One calm reading column, like a personal blog", tags: ["Classic", "Minimal"], Component: EssayPortfolio },
  { id: "timeline", name: "Timeline", tagline: "Your whole story along one vertical journey", tags: ["Creative"], Component: TimelinePortfolio },
  { id: "executive", name: "Executive", tagline: "Navy and gold with formal serif type", tags: ["Professional", "Classic"], Component: ExecutivePortfolio },
  { id: "retro", name: "Retro OS", tagline: "A 90s desktop where every section is a window", tags: ["Playful", "Developer"], Component: RetroPortfolio },
  { id: "studio", name: "Studio", tagline: "A designer showreel with a giant scrolling name", tags: ["Creative"], Component: StudioPortfolio },
  { id: "split", name: "Split", tagline: "Half bold color panel, half scrolling story", tags: ["Creative", "Professional"], Component: SplitPortfolio },
  { id: "resume", name: "Resume", tagline: "A printed two-column résumé on a desk", tags: ["Professional"], Component: ResumePortfolio },
  { id: "blueprint", name: "Blueprint", tagline: "An engineering drawing with a title block", tags: ["Developer"], Component: BlueprintPortfolio },
  { id: "zen", name: "Zen", tagline: "Washi paper, an ink ensō and a red name seal", tags: ["Minimal", "Classic"], Component: ZenPortfolio },
  { id: "gazette", name: "Gazette", tagline: "A broadsheet front page with a masthead and drop caps", tags: ["Classic"], Component: GazettePortfolio },
  { id: "polaroid", name: "Polaroid", tagline: "A corkboard of instant photos and pinned paper", tags: ["Playful"], Component: PolaroidPortfolio },
  { id: "arcade", name: "Arcade", tagline: "8-bit stages, a score HUD and health-bar skills", tags: ["Playful", "Developer"], Component: ArcadePortfolio },
  { id: "cosmos", name: "Cosmos", tagline: "A starfield, a ringed planet and orbiting sections", tags: ["Creative"], Component: CosmosPortfolio },
  { id: "ledger", name: "Ledger", tagline: "Green-bar printer paper with tractor-feed holes", tags: ["Classic", "Professional"], Component: LedgerPortfolio },
  { id: "boarding", name: "Boarding Pass", tagline: "Your career as a flight ticket with tear-off stubs", tags: ["Creative"], Component: BoardingPortfolio },
  { id: "metro", name: "Metro", tagline: "A transit map where every section is its own line", tags: ["Creative", "Minimal"], Component: MetroPortfolio },
  { id: "museum", name: "Museum", tagline: "A framed portrait, wall labels and gallery rooms", tags: ["Classic"], Component: MuseumPortfolio },
  { id: "vinyl", name: "Vinyl", tagline: "A record sleeve with a spinning disc and a tracklist", tags: ["Creative"], Component: VinylPortfolio },
  { id: "botanical", name: "Botanical", tagline: "A herbarium sheet with drawn leaves and plates", tags: ["Classic"], Component: BotanicalPortfolio },
  { id: "memphis", name: "Memphis", tagline: "80s confetti shapes and bold colour bands", tags: ["Playful", "Creative"], Component: MemphisPortfolio },
  { id: "launch", name: "Launch", tagline: "A product landing page with a pitch and feature panels", tags: ["Professional"], Component: LaunchPortfolio },
  { id: "dossier", name: "Dossier", tagline: "A manila case file with a stamp and typed exhibits", tags: ["Playful"], Component: DossierPortfolio },
  { id: "noir", name: "Noir", tagline: "A letterboxed film title card and numbered scenes", tags: ["Creative"], Component: NoirPortfolio },
  { id: "candy", name: "Candy", tagline: "Pastel blobs and squishy rounded cards", tags: ["Playful"], Component: CandyPortfolio },
  { id: "circuit", name: "Circuit", tagline: "A circuit board with your name on the chip", tags: ["Developer"], Component: CircuitPortfolio },
  { id: "ide", name: "Code Editor", tagline: "A file explorer, line numbers and one file per section", tags: ["Developer"], Component: IdePortfolio },
  { id: "atlas", name: "Atlas", tagline: "A contour map with a compass and route waypoints", tags: ["Creative"], Component: AtlasPortfolio },
  { id: "slate", name: "Slate", tagline: "A clean professional profile with a cover banner", tags: ["Professional", "Minimal"], Component: SlatePortfolio }
];

// Every design needs its own id (it is the URL) and its own name
if (import.meta.env.DEV) {
  for (const key of ["id", "name"]) {
    const seen = new Set();
    for (const design of DESIGNS) {
      if (seen.has(design[key])) throw new Error(`Two portfolio designs share the ${key} "${design[key]}"`);
      seen.add(design[key]);
    }
  }
}

export const DESIGN_TAGS = ["All", ...new Set(DESIGNS.flatMap((design) => design.tags))];

export const designById = (id) => DESIGNS.find((design) => design.id === id);
