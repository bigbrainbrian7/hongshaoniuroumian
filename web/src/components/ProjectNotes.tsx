export function ProjectNotes() {
  return (
    <section className="project-notes">
      <div className="project-notes-heading">
        <h2>Project Notes</h2>
      </div>
      <article className="project-article">
        <p>
          Log anomaly detection
          Splits logs into template and parameters using Drain3
          Vectorizes tempelates using BERT, ensuring context-aware vectors with some semantic understanding
          Parameters are vectorized depending on their type (Time, ip, number, string)
          Windows of 100 logs are fed to predict the next log embedding
          Templates and parameters independently fed into a BiLSTM, with an additive attention layer on top
          The real log is vectorized and is compared using cosine similarity
          Logs above a certain cosine distance are classified as anomalies and reported
        </p>

        <p>
          This site is merely a playback of some logs that have already been fed into the model, but you can see realtime detection here!
        </p>
      </article>
    </section>
  );
}
