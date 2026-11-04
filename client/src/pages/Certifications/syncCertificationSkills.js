import {
  createSkillAssociation,
  deleteSkillAssociation
} from "../../api/skillAssociationApi";

// Makes the certification's links match `chosen` ([{ skillId, name,
// associationId? }]); the skills already exist on the Skills page.
// `removed` holds association IDs to unlink. Returns failure messages.
export async function syncCertificationSkills(certificationId, chosen, removed) {
  const errors = [];
  const fail = (err, fallback) =>
    errors.push(err.response?.data?.message || fallback);

  for (const associationId of removed) {
    try {
      await deleteSkillAssociation(associationId);
    } catch (err) {
      fail(err, "Unable to unlink a skill");
    }
  }

  for (const skill of chosen.filter((item) => !item.associationId)) {
    try {
      await createSkillAssociation({
        skillId: skill.skillId,
        sourceType: "certification",
        sourceId: certificationId
      });
    } catch (err) {
      fail(err, `Unable to link ${skill.name}`);
    }
  }

  return errors;
}
