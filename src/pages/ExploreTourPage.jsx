import './ExploreTourPage.css'

export default function ExploreTourPage() {
  return (
    <section className="explore-tour">
      <iframe
        className="explore-tour__frame"
        title="CELESTRIA cinematic exploration"
        src="/celestria-tour/index.html"
        allow="autoplay"
      />
    </section>
  )
}
