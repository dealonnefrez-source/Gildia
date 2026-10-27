const SUPABASE_URL = "https://sfpdvmrxxrzonicargst.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VTdw4aRSDAAXqVJoyLwZ_Q_Wrgo77cN";

const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubmit = document.querySelector("#auth-submit");
const authMessage = document.querySelector("#auth-message");
const authModeToggle = document.querySelector("#auth-mode-toggle");
const authSwitchLabel = document.querySelector("#auth-switch-label");
const profileForm = document.querySelector("#profile-form");
const profileMessage = document.querySelector("#profile-message");
const eventForm = document.querySelector("#event-form");
const eventMessage = document.querySelector("#event-message");
const calendarMessage = document.querySelector("#calendar-message");
const eventsList = document.querySelector("#events-list");

let supabaseClient;
let currentUser;
let isRegisterMode = false;

function setMessage(element, message, kind = "") {
  element.textContent = message;
  if (kind) {
    element.dataset.kind = kind;
  } else {
    delete element.dataset.kind;
  }
}

function setAuthenticatedView(user) {
  currentUser = user ?? undefined;
  authScreen.classList.toggle("is-hidden", Boolean(user));
  appShell.classList.toggle("is-hidden", !user);

  if (user) {
    document.querySelector("#signed-in-email").textContent = user.email ?? "";
    loadProfile();
  }
}

function setAuthMode(registerMode) {
  isRegisterMode = registerMode;
  authTitle.textContent = registerMode ? "Dołącz do Paktu" : "Witaj, wojowniku";
  authSubmit.textContent = registerMode ? "Utwórz konto" : "Zaloguj się";
  authSwitchLabel.textContent = registerMode ? "Masz już konto?" : "Nie masz jeszcze konta?";
  authModeToggle.textContent = registerMode ? "Zaloguj się" : "Zarejestruj się";
  document.querySelector("#auth-password").autocomplete = registerMode ? "new-password" : "current-password";
  setMessage(authMessage, "");
}

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("character_name, race, character_class, profession")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setMessage(profileMessage, `Nie udało się pobrać karty postaci: ${error.message}`, "error");
    return;
  }

  profileForm.elements.character_name.value = data?.character_name ?? "";
  profileForm.elements.race.value = data?.race ?? "";
  profileForm.elements.character_class.value = data?.character_class ?? "";
  profileForm.elements.profession.value = data?.profession ?? "";
  setMessage(profileMessage, "");
}

function makeAttendeeList(signups) {
  const names = signups
    .map((signup) => signup.character_name || "Nieuzupełniona karta postaci");

  return names.length ? names.join(", ") : "Brak zapisanych osób";
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const title = document.createElement("h4");
  title.textContent = event.title;

  const date = document.createElement("p");
  date.className = "event-meta";
  date.textContent = new Date(event.starts_at).toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
  });

  card.append(title, date);

  if (event.description) {
    const description = document.createElement("p");
    description.className = "event-description";
    description.textContent = event.description;
    card.append(description);
  }

  const attendees = document.createElement("p");
  attendees.className = "event-attendees";
  const attendeeLabel = document.createElement("strong");
  attendeeLabel.textContent = "Zapisani: ";
  attendees.append(attendeeLabel, document.createTextNode(makeAttendeeList(event.event_signups ?? [])));
  card.append(attendees);

  const signupButton = document.createElement("button");
  signupButton.className = "button button--secondary";
  signupButton.type = "button";
  signupButton.textContent = "Zapisz się";
  signupButton.addEventListener("click", () => signUpForEvent(event.id, signupButton));
  card.append(signupButton);

  if (event.event_signups?.some((signup) => signup.user_id === currentUser.id)) {
    signupButton.disabled = true;
    signupButton.textContent = "Już zapisano";
  }

  return card;
}

async function loadEvents() {
  if (!currentUser) return;

  setMessage(calendarMessage, "Wczytywanie wydarzeń...");
  eventsList.replaceChildren();

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseClient
    .from("events")
    .select("id, title, starts_at, description, event_signups(user_id)")
    .gte("starts_at", cutoff.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    setMessage(calendarMessage, `Nie udało się pobrać wydarzeń: ${error.message}`, "error");
    return;
  }

  const userIds = [...new Set(data.flatMap((event) => (event.event_signups ?? []).map((signup) => signup.user_id)))];
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, character_name")
      .in("user_id", userIds);

    if (profilesError) {
      setMessage(calendarMessage, `Nie udało się pobrać zapisanych postaci: ${profilesError.message}`, "error");
      return;
    }

    const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id, profile.character_name]));
    data.forEach((event) => {
      event.event_signups.forEach((signup) => {
        signup.character_name = profilesByUserId.get(signup.user_id) ?? "";
      });
    });
  }

  if (!data.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Brak wydarzeń. Dodaj pierwsze wydarzenie gildii!";
    eventsList.append(emptyState);
  } else {
    eventsList.append(...data.map(createEventCard));
  }
  setMessage(calendarMessage, "");
}

async function signUpForEvent(eventId, button) {
  if (!currentUser) return;

  button.disabled = true;
  const { error } = await supabaseClient
    .from("event_signups")
    .upsert(
      { event_id: eventId, user_id: currentUser.id },
      { onConflict: "event_id,user_id", ignoreDuplicates: true },
    );

  if (error) {
    button.disabled = false;
    setMessage(calendarMessage, `Nie udało się zapisać na wydarzenie: ${error.message}`, "error");
    return;
  }

  await loadEvents();
}

function activateView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    const isActive = view.id === viewId;
    view.classList.toggle("is-active", isActive);
    view.hidden = !isActive;
  });

  document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
    const isActive = button.dataset.view === viewId;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (viewId === "calendar-view") loadEvents();
}

authModeToggle.addEventListener("click", () => setAuthMode(!isRegisterMode));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = formData.get("email").trim();
  const password = formData.get("password");
  authSubmit.disabled = true;
  setMessage(authMessage, "");

  const result = isRegisterMode
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });

  authSubmit.disabled = false;

  if (result.error) {
    setMessage(authMessage, `Nie udało się ${isRegisterMode ? "utworzyć konta" : "zalogować"}: ${result.error.message}`, "error");
    return;
  }

  if (isRegisterMode && !result.data.session) {
    setMessage(authMessage, "Konto utworzone. Sprawdź pocztę i kliknij link aktywacyjny, aby potwierdzić adres e-mail.", "success");
    authForm.reset();
    return;
  }

  setMessage(authMessage, "Logowanie zakończone powodzeniem.", "success");
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(profileForm);
  const { error } = await supabaseClient.from("profiles").upsert({
    user_id: currentUser.id,
    character_name: formData.get("character_name").trim(),
    race: formData.get("race"),
    character_class: formData.get("character_class"),
    profession: formData.get("profession").trim(),
  });

  if (error) {
    setMessage(profileMessage, `Nie udało się zapisać karty postaci: ${error.message}`, "error");
    return;
  }
  setMessage(profileMessage, "Karta postaci została zapisana.", "success");
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(eventForm);
  const startsAt = new Date(formData.get("starts_at"));
  if (Number.isNaN(startsAt.getTime())) {
    setMessage(eventMessage, "Podaj prawidłową datę i godzinę wydarzenia.", "error");
    return;
  }

  const { error } = await supabaseClient.from("events").insert({
    title: formData.get("title").trim(),
    starts_at: startsAt.toISOString(),
    description: formData.get("description").trim() || null,
    created_by: currentUser.id,
  });

  if (error) {
    setMessage(eventMessage, `Nie udało się dodać wydarzenia: ${error.message}`, "error");
    return;
  }

  eventForm.reset();
  setMessage(eventMessage, "Wydarzenie dodane do kalendarza.", "success");
  await loadEvents();
});

document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

document.querySelector("#refresh-events").addEventListener("click", loadEvents);

document.querySelector("#logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setMessage(document.querySelector("#app-message"), `Nie udało się wylogować: ${error.message}`, "error");
  }
});

async function initializeApp() {
  if (!window.supabase) {
    setMessage(authMessage, "Nie udało się załadować biblioteki Supabase. Odśwież stronę i spróbuj ponownie.", "error");
    authSubmit.disabled = true;
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setMessage(authMessage, "Uzupełnij SUPABASE_URL i SUPABASE_ANON_KEY w pliku app.js, aby połączyć aplikację z projektem Supabase.", "error");
    authSubmit.disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setMessage(authMessage, `Nie udało się sprawdzić sesji: ${error.message}`, "error");
    return;
  }
  setAuthenticatedView(data.session?.user);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    queueMicrotask(() => setAuthenticatedView(session?.user));
  });
}

initializeApp();
