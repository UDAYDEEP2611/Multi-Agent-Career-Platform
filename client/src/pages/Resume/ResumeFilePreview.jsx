import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Spinner } from "react-bootstrap";
import { getMatchLogFile } from "../../api/resumeApi";

const PDF = "application/pdf";
const isPdf = (file) => file?.type === PDF || /\.pdf$/i.test(file?.name || "");
const isText = (file) => /^text\//.test(file?.type || "") || /\.(txt|md)$/i.test(file?.name || "");

// Shows a resume: a PDF as itself, anything else as the text that was read
// from it (browsers can't show DOCX or RTF files).
//   file    a File chosen on this device, before comparing
//   logId   a saved log entry: its file is fetched from the server
//   text    the text read from the file, for DOCX/RTF
export default function ResumeFilePreview({ show, onHide, file, logId, fileType, fileName, text }) {
  const [localText, setLocalText] = useState("");
  // The server's copy of a saved file: { url, error }
  const [remote, setRemote] = useState({ url: "", error: "" });
  const pdf = file ? isPdf(file) : fileType === PDF;

  // A chosen PDF is shown straight from this device
  const localUrl = useMemo(() => (show && file && pdf ? URL.createObjectURL(file) : ""), [show, file, pdf]);
  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  useEffect(() => {
    if (!show) return undefined;
    let active = true;
    let objectUrl = "";

    if (file && isText(file)) {
      file.text().then((value) => active && setLocalText(value));
    } else if (!file && logId && pdf) {
      getMatchLogFile(logId)
        .then(({ data }) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(new Blob([data], { type: PDF }));
          setRemote({ url: objectUrl, error: "" });
        })
        .catch(() => active && setRemote({ url: "", error: "Couldn't load the file; it may have expired." }));
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [show, file, logId, pdf]);

  const close = () => {
    setRemote({ url: "", error: "" });
    onHide();
  };
  const url = localUrl || remote.url;
  const error = remote.error;
  const loading = show && !file && logId && pdf && !remote.url && !remote.error;
  // A chosen text file reads itself; DOCX/RTF show what the server read
  const shownText = (file && localText) || text;
  const name = file?.name || fileName;

  return (
    <Modal show={show} onHide={close} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5"><i className="bi bi-file-earmark-text me-2" aria-hidden="true" />{name || "Resume"}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        {error && <Alert variant="danger" className="m-3">{error}</Alert>}
        {loading && <div className="p-4 text-center"><Spinner size="sm" className="me-2" />Loading the file…</div>}
        {pdf && url && <iframe title={`Preview of ${name}`} src={url} style={{ width: "100%", height: "75vh", border: 0 }} />}
        {!pdf && shownText && (
          <>
            {!isText(file || { name, type: fileType }) && (
              <div className="small text-muted px-3 pt-3">Browsers can't show this file type, so this is the text that was read from it: what an ATS sees.</div>
            )}
            <pre className="p-3 mb-0 small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{shownText}</pre>
          </>
        )}
        {!pdf && !shownText && !error && (
          <div className="p-4 text-muted small">
            {file ? "A preview of this file type is available after you compare: it shows the text that was read from it." : "No text to show."}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
