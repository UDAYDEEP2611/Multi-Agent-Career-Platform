import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Accordion, Alert, Button, Card, Spinner } from "react-bootstrap";

import { getAchievement, updateAchievement } from "../../api/achievementApi";
import AchievementModal from "./AchievementModal";
import AchievementHeader from "./AchievementHeader";
import useContextLabels from "./useContextLabels";
import { ACHIEVEMENT_LIMITS } from "./achievementOptions";
import EducationProjectMediaSection from "../Education/EducationProjectMediaSection";
import useRememberedSections from "../Layout/useRememberedSections";

export default function AchievementDetails() {
  const { achievementId } = useParams();
  const { experiences, educations, labels } = useContextLabels();
  const openSections = useRememberedSections(
    `open-sections:achievement:${achievementId}`,
    ["media"]
  );

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;

    getAchievement(achievementId)
      .then(({ data }) => {
        if (active) setItem(data.achievement);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load achievement");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [achievementId]);

  const save = async (payload) => {
    const { data } = await updateAchievement(achievementId, payload);
    setItem(data.achievement);
  };

  const backLink = (
    <Link to="/dashboard/achievements" className="text-decoration-none">
      <i className="bi bi-arrow-left me-2" />
      Back to Activity & Achievements
    </Link>
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container-fluid">
        {backLink}
        <Alert variant="danger" className="mt-3">
          {error || "Achievement not found."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {backLink}

      <Card className="border-0 shadow-sm my-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <AchievementHeader
              item={item}
              contextLabel={item.contextId ? labels[item.contextId] : ""}
              titleAs="h4"
            />

            <Button
              size="sm"
              variant="outline-secondary"
              className="flex-shrink-0"
              onClick={() => setShowModal(true)}
            >
              <i className="bi bi-pencil me-1" />
              Edit
            </Button>
          </div>

          <p
            className={`mt-3 mb-0 ${item.description ? "" : "text-secondary"}`}
            style={{ whiteSpace: "pre-line" }}
          >
            {item.description || "No description added."}
          </p>
        </Card.Body>
      </Card>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <EducationProjectMediaSection
          key={`media-${achievementId}`}
          basePath={`/achievements/${achievementId}`}
          max={ACHIEVEMENT_LIMITS.media}
        />
      </Accordion>

      <AchievementModal
        show={showModal}
        achievement={item}
        experiences={experiences}
        educations={educations}
        onHide={() => setShowModal(false)}
        onSave={save}
      />
    </div>
  );
}
