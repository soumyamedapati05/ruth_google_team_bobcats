// Matching stub. This is where the backend plugs in.
//
// Replace `matchScholarships` with a call to your API, e.g.
//   fetch('/api/match', { method: 'POST', body: JSON.stringify({ answers }) })
// The API should:
//   1. Pull a profile out of the answers (year, field, background, activities).
//   2. Compare it against your scholarship database's eligibility rules.
//   3. Return the best fits, each with a one-line reason tied to what the student said.
//
// For now it returns placeholder data so the front end can be built and tested.
window.matchScholarships = function (answers) {
  return Promise.resolve({
    traits: ['First-year', 'Biology', 'Public health', 'Works in family restaurant', 'Started a tutoring group'],
    matches: [
      { name: '[Scholarship name]', amount: '[$ Amount]', deadline: '[Date]', fit: 'Strong fit', why: 'You want to go into public health.', url: '#',
        art: 'radial-gradient(circle at 50% 30%, #A9D0F4 0%, #A9D0F4 14%, #E2A066 16%, #B8653A 40%, #4A1E0F 100%)' },
      { name: '[Scholarship name]', amount: '[$ Amount]', deadline: '[Date]', fit: 'Strong fit', why: 'You started and ran a tutoring group for three years.', url: '#',
        art: 'radial-gradient(ellipse at 50% 0%, #D9B6EE 0%, #9FB2F2 30%, #3E63D8 55%, #0A1030 100%)' },
      { name: '[Scholarship name]', amount: '[$ Amount]', deadline: '[Date]', fit: 'Good fit', why: "You've worked in your family's restaurant since you were fourteen.", url: '#',
        art: 'linear-gradient(90deg, #8FB8B4 0%, #DDEFEC 50%, #8FB8B4 100%)' }
    ]
  });
};
