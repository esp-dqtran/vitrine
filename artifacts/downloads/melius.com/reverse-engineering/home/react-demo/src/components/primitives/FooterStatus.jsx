export function FooterStatus({ status = "operational" }) {
  const operational = status === "operational";

  return <div className="footer-status" data-status={operational ? "operational" : "issue"}>
    <span aria-hidden="true" className="footer-status__dot" />
    <p>Status: {operational ? "Up" : "Down"}</p>
  </div>;
}
