import { useEffect, useState } from "react";

import { getExperiences } from "../../api/experienceApi";
import { getEducations } from "../../api/educationApi";
import { contextLabels } from "../Recommendations/recommendationOptions";

// The user's experiences and educations, for "Associated with" choices
// and labels. Failures leave the lists empty; they are a nice-to-have.
export default function useContextLabels() {
  const [records, setRecords] = useState({ experiences: [], educations: [] });

  useEffect(() => {
    let active = true;

    Promise.all([
      getExperiences().catch(() => ({ data: {} })),
      getEducations().catch(() => ({ data: {} }))
    ]).then(([experienceResponse, educationResponse]) => {
      if (!active) return;
      setRecords({
        experiences: experienceResponse.data.experiences || [],
        educations: educationResponse.data.educations || []
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return {
    ...records,
    labels: contextLabels(records.experiences, records.educations)
  };
}
