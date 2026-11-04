import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Accordion, Alert, Button, Card, Spinner } from "react-bootstrap";

import { getVolunteeringRole, updateVolunteering } from "../../api/volunteeringApi";
import VolunteeringModal from "./VolunteeringModal";
import VolunteeringHeader from "./VolunteeringHeader";
import { VOLUNTEERING_LIMITS } from "./volunteeringOptions";
import EducationProjectMediaSection from "../Education/EducationProjectMediaSection";
import useRememberedSections from "../Layout/useRememberedSections";

export default function VolunteeringDetails() {
  const { volunteeringId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:volunteering:${volunteeringId}`,
    ["media"]
  );

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;

    getVolunteeringRole(volunteeringId)
      .then(({ data }) => {
        if (active) setItem(data.volunteering);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load volunteering");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [volunteeringId]);

  const save = async (payload) => {
    const { data } = await updateVolunteering(volunteeringId, payload);
    setItem(data.volunteering);
  };

  const backLink = (
    <Link to="/dashboard/volunteering" className="text-decoration-none">
      <i className="bi bi-arrow-left me-2" />
      Back to Volunteering
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
          {error || "Volunteering not found."}
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
            <VolunteeringHeader item={item} roleAs="h4" />

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
          key={`media-${volunteeringId}`}
          basePath={`/volunteering/${volunteeringId}`}
          max={VOLUNTEERING_LIMITS.media}
        />
      </Accordion>

      <VolunteeringModal
        show={showModal}
        volunteering={item}
        onHide={() => setShowModal(false)}
        onSave={save}
      />
    </div>
  );
}
