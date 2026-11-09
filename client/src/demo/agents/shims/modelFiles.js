import action from "../../../../../server/services/nlp/models/action.json";
import intent from "../../../../../server/services/nlp/models/intent.json";
import modelCard from "../../../../../server/services/nlp/models/model-card.json";
import section from "../../../../../server/services/nlp/models/section.json";

// The trained models, bundled: the demo has no file system to read them from
const FILES = { action, intent, section, "model-card": modelCard };

export const readModelFile = (name) => {
  if (!FILES[name]) throw new Error(`No model file ${name}`);
  return structuredClone(FILES[name]);
};
