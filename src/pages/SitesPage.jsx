import SitesAdmin from "../components/SitesAdmin.jsx";

// Resources → Sites. Sites are the parent categories of place on the
// farm; each site holds one or more locations where chores happen,
// animals live, or other significant work occurs.
//
// The auto SectionHeader (rendered by App.jsx) provides the page
// title + description, so this component is just the body.

export default function SitesPage({ data }) {
  return <SitesAdmin data={data} />;
}
