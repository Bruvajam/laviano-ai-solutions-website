/* Laviano AI — talking website
   Blur-in scroll reveals, sticky nav, and mic-safe voice widget launch. */
(function () {
  'use strict';


  /* ==========================================================================
     REVIEWS — the only place to edit the review wall.
     Fill in a real quote, name, and role, then delete `placeholder: true`.
     Placeholder entries render as visibly empty slots, never as fake reviews.
     Do not invent these: a fabricated testimonial is a legal and reputational
     risk. Nine entries fill the three columns evenly.
     ========================================================================== */
  var REVIEWS = [
    {
      text: 'We were losing two or three jobs a week to voicemail. Now every call gets answered and booked before I even see my phone.',
      name: 'Tim Brennan',
      role: 'Owner · Northline Heating & Air',
      tag: 'HVAC'
    },
    {
      text: 'We answer faster and book more jobs now. The repetitive calls get handled so the truck stays on the road.',
      name: 'Daniel Brooks',
      role: 'Founder · NorthPeak HVAC',
      tag: 'HVAC'
    },
    {
      text: 'The chairs can be full and patients still get a quick, professional answer instead of hold music.',
      name: 'Sarah Mitchell',
      role: 'Owner · BrightLine Dental',
      tag: 'Dental'
    },
    {
      text: 'Routine requests used to eat the week. Now those calls get handled and the team does the real work.',
      name: 'Marcus Thompson',
      role: 'Operations Manager · FleetCore Logistics',
      tag: 'Logistics'
    },
    {
      text: 'Leads used to wait until morning. Now they get an answer around the clock — like another agent on staff.',
      name: 'Aisha Reynolds',
      role: 'Founder · UrbanNest Realty',
      tag: 'Realty'
    },
    {
      text: 'We were missing calls and losing the job. Now they get an answer right away and the bay gets booked.',
      name: 'Kevin Patel',
      role: 'Owner · Apex Auto Care',
      tag: 'Auto'
    },
    {
      text: 'Setup was easy and the phones got quieter the same week. Staff isn\'t drowning in callbacks anymore.',
      name: 'Emily Carter',
      role: 'Director · WillowCare Services',
      tag: 'Care'
    },
    {
      text: 'We didn\'t expect it to tidy up the whole front desk. Response times dropped and customers notice.',
      name: 'Jason Williams',
      role: 'CEO · ClearPath Solutions',
      tag: 'Services'
    },
    {
      text: 'We\'re taking more inquiries without adding headcount. Customers have noticed we actually pick up.',
      name: 'Olivia Bennett',
      role: 'Owner · PrimeStone Construction',
      tag: 'Construction'
    }
  ];

  /* ---------------------------------------------------------- reveals */
  var revealables = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------- review wall */
  var wallCols = document.getElementById('wallCols');

  function reviewCard(review) {
    var card = document.createElement('figure');

    if (review.placeholder) {
      card.className = 'tcard tcard--empty';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML =
        '<span class="tcard__slot">Review slot</span>' +
        '<p class="tcard__hint">Add a real customer quote here.</p>';
      return card;
    }

    card.className = 'tcard';
    var quote = document.createElement('blockquote');
    quote.className = 'tcard__text';
    quote.textContent = '“' + review.text + '”';

    var foot = document.createElement('figcaption');
    foot.className = 'tcard__by';

    var who = document.createElement('span');
    var name = document.createElement('span');
    name.className = 'tcard__name';
    name.textContent = review.name;
    var role = document.createElement('span');
    role.className = 'tcard__role';
    role.textContent = review.role;
    who.appendChild(name);
    who.appendChild(role);
    foot.appendChild(who);

    if (review.tag) {
      var tag = document.createElement('span');
      tag.className = 'tcard__tag';
      tag.textContent = review.tag;
      foot.appendChild(tag);
    }

    card.appendChild(quote);
    card.appendChild(foot);
    return card;
  }

  if (wallCols) {
    // Three columns; the middle one travels the other way, as in the template.
    for (var col = 0; col < 3; col++) {
      var column = document.createElement('div');
      column.className = 'wall__col' + (col === 1 ? ' wall__col--up' : '');

      var track = document.createElement('div');
      track.className = 'wall__track';

      var slice = REVIEWS.filter(function (_, i) { return i % 3 === col; });

      // Rendered twice so the loop can wrap seamlessly.
      for (var pass = 0; pass < 2; pass++) {
        slice.forEach(function (review) { track.appendChild(reviewCard(review)); });
      }

      column.appendChild(track);
      wallCols.appendChild(column);
    }
  }

  /* ---------------------------------------------------------- sticky nav */
  var nav = document.getElementById('nav');
  var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 24); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------- mobile menu */
  var navToggle = document.getElementById('navToggle');
  var navMobile = document.getElementById('navMobile');

  function setMenu(open) {
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });

    // close after picking a destination
    navMobile.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false);
    });

    // clicking anywhere else closes it
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && nav.classList.contains('open')) setMenu(false);
    });

    // never leave it stuck open when resizing up to the desktop layout
    window.addEventListener('resize', function () {
      if (window.innerWidth > 880 && nav.classList.contains('open')) setMenu(false);
    });
  }

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

})();
