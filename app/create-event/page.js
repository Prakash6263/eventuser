"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "../components/Header";
import Footer from "../components/Footer";
import styles from "./create-event.module.css";
import { getEventTypesApi, getEventCategoriesByTypeIdApi, getPlacePreferencesApi, getMerchantsByServiceApi, getEventNotesApi, createEventApi, getMyCreatedEventsApi } from "../services/eventApi";
import { syncContactsApi, getAllUsersApi, getAddressesApi, addAddressApi } from "../services/authApi";
import { makeReservationApi } from "../services/reservationApi";
import CountryCodePicker from "../components/CountryCodePicker";
import { isLoggedIn } from "../services/apiClient";

const steps = [
  { id: "date", label: "Date & time", icon: "fa-calendar-days" },
  { id: "category", label: "Event details", icon: "fa-shapes" },
  { id: "place", label: "Event place", icon: "fa-location-dot" },
  { id: "restaurants", label: "Venue", icon: "fa-utensils" },
  { id: "guests", label: "Guests", icon: "fa-user-group" },
  { id: "guestInfo", label: "Guest options", icon: "fa-clipboard-check" },
  { id: "registry", label: "Gift registry", icon: "fa-gift" },
  { id: "notes", label: "Notes", icon: "fa-note-sticky" },
  { id: "content", label: "Invitation", icon: "fa-envelope-open-text" },
  { id: "review", label: "Review", icon: "fa-list-check" },
];



// Static contacts list removed. Contacts are now loaded from the backend or local storage.

const locations = [
  "12, near Aurobindo Hospital, Rishi Nagar, Indore",
  "6W6C+7GP, Sel Pinang, Mandau Talawang, Indore",
];


function getCalendarDays(month) {
  const firstDay = new Date(2026, month, 1).getDay();
  const monthLength = new Date(2026, month + 1, 0).getDate();
  const previousMonthLength = new Date(2026, month, 0).getDate();
  const days = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    days.push({ number: previousMonthLength - index, outside: true });
  }
  for (let day = 1; day <= monthLength; day += 1) {
    days.push({ number: day, outside: false });
  }
  for (let day = 1; days.length < 42; day += 1) {
    days.push({ number: day, outside: true });
  }

  return days;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState("date");
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
  const [month, setMonth] = useState(6);
  const [selectedDate, setSelectedDate] = useState(14);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState("Birthday");
  const [eventType, setEventType] = useState("Family Celebration");
  const [place, setPlace] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filterCoords, setFilterCoords] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [bringGuests, setBringGuests] = useState("No");
  const [rsvp, setRsvp] = useState("No");
  const [maxGuests, setMaxGuests] = useState("");
  const [rsvpBy, setRsvpBy] = useState("");
  const [registryUrl, setRegistryUrl] = useState("");
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [customNote, setCustomNote] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [eventImage, setEventImage] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [subview, setSubview] = useState(null);
  const [placeSearch, setPlaceSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [completionMode, setCompletionMode] = useState("sent");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", countryCode: "+91" });
  const [contactError, setContactError] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Reservation modal state
  const [reservationModal, setReservationModal] = useState(false);
  const [createdEventId, setCreatedEventId] = useState("");
  const [createdMerchantName, setCreatedMerchantName] = useState("");
  const [resAdultCount, setResAdultCount] = useState("");
  const [resInstruction, setResInstruction] = useState("");
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resSuccess, setResSuccess] = useState(false);
  const [resError, setResError] = useState("");

  // Event Types & Categories API state
  const [eventTypesList, setEventTypesList] = useState([]);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState("");
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loadingEventData, setLoadingEventData] = useState(false);

  // Place Preferences API state
  const [placePreferencesList, setPlacePreferencesList] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  // Merchants / Restaurants API state
  const [merchantRestaurants, setMerchantRestaurants] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  // Event Notes API state
  const [eventNotesList, setEventNotesList] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Private address state variables
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isPrivateLocationCheckbox, setIsPrivateLocationCheckbox] = useState(true);
  
  // New private address inputs
  const [newPrivateAddress, setNewPrivateAddress] = useState({
    addressName: "",
    address1: "",
    address2: "",
    postcode: ""
  });
  const [addAddressError, setAddAddressError] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const fetchSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const res = await getAddressesApi();
      if (res && res.status && Array.isArray(res.addresses)) {
        const mappedAddresses = res.addresses.map(addr => ({
          ...addr,
          address: `${addr.address1 || ""}, ${addr.address2 || ""}, ${addr.postcode || ""}`.replace(/^,\s*|,\s*$/g, '')
        }));
        setSavedAddresses(mappedAddresses);
        // Automatically select the first address if none is selected
        if (mappedAddresses.length > 0 && !selectedLocation) {
          setSelectedLocation(mappedAddresses[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load saved addresses:", err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddPrivateAddress = async () => {
    const { addressName, address1, address2, postcode } = newPrivateAddress;
    if (!addressName.trim() || !address1.trim() || !address2.trim() || !postcode.trim()) {
      setAddAddressError("All address fields are required.");
      return;
    }

    setIsAddingAddress(true);
    setAddAddressError("");
    try {
      const res = await addAddressApi({ addressName, address1, address2, postcode });
      if (res && res.status) {
        setNewPrivateAddress({ addressName: "", address1: "", address2: "", postcode: "" });
        const newAddr = res.address || res.data;
        await fetchSavedAddresses();
        if (newAddr && newAddr._id) {
          newAddr.address = `${newAddr.address1 || ""}, ${newAddr.address2 || ""}, ${newAddr.postcode || ""}`.replace(/^,\s*|,\s*$/g, '');
          setSelectedLocation(newAddr);
        }
        setSubview("private-address");
      } else {
        throw new Error(res?.message || "Failed to add address.");
      }
    } catch (err) {
      setAddAddressError(err.message || "An error occurred while adding the address.");
    } finally {
      setIsAddingAddress(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    async function loadEventTypes() {
      setLoadingEventData(true);
      try {
        const res = await getEventTypesApi();
        if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
          setEventTypesList(res.data);
          const firstType = res.data[0];
          setSelectedEventTypeId(firstType._id);
          setCategory(firstType.eventType);

          if (Array.isArray(firstType.categories) && firstType.categories.length > 0) {
            setCategoriesList(firstType.categories);
            setSelectedCategoryId(firstType.categories[0]._id);
            setEventType(firstType.categories[0].category);
          } else {
            setCategoriesList([]);
            setEventType("");
          }
        }
      } catch (err) {
        console.error("Failed to load event types:", err);
      } finally {
        setLoadingEventData(false);
      }
    }

    async function loadPlacePreferences() {
      setLoadingPlaces(true);
      try {
        const res = await getPlacePreferencesApi();
        if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
          setPlacePreferencesList(res.data);
        }
      } catch (err) {
        console.error("Failed to load place preferences:", err);
      } finally {
        setLoadingPlaces(false);
      }
    }

    async function loadEventNotes() {
      setLoadingNotes(true);
      try {
        const res = await getEventNotesApi();
        if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
          setEventNotesList(res.data);
        }
      } catch (err) {
        console.error("Failed to load event notes:", err);
      } finally {
        setLoadingNotes(false);
      }
    }

    loadEventTypes();
    loadPlacePreferences();
    loadEventNotes();
    fetchSavedAddresses();
  }, []);

  const currentServiceId = useMemo(() => {
    if (place === "Restaurant from list" || place === "restaurant" || place === "6877a86668d1e0b9fcdf5006") {
      return "686fb6ced46e9740ee8277ec";
    }
    if (place === "Other participating facilities" || place === "facility" || place === "6877a87c68d1e0b9fcdf5010") {
      return "686fb6dcd46e9740ee8277ee";
    }
    return null;
  }, [place]);

  useEffect(() => {
    if (!currentServiceId) return;

    async function fetchFilteredMerchants() {
      setLoadingMerchants(true);
      try {
        const lat = filterCoords ? filterCoords.lat : null;
        const lng = filterCoords ? filterCoords.lng : null;
        const res = await getMerchantsByServiceApi(currentServiceId, lat, lng, 100);
        if (res && res.status && Array.isArray(res.data)) {
          setMerchantRestaurants(res.data);
        } else {
          setMerchantRestaurants([]);
        }
      } catch (err) {
        console.error("Failed to load merchants:", err);
        setMerchantRestaurants([]);
      } finally {
        setLoadingMerchants(false);
      }
    }

    fetchFilteredMerchants();
  }, [currentServiceId, filterCoords]);

  const handleEventTypeChange = async (typeId) => {
    setSelectedEventTypeId(typeId);
    const foundType = eventTypesList.find((t) => t._id === typeId);
    if (foundType) {
      setCategory(foundType.eventType);

      try {
        const catRes = await getEventCategoriesByTypeIdApi(typeId);
        let cats = [];
        if (catRes && catRes.status && Array.isArray(catRes.data) && catRes.data.length > 0) {
          cats = catRes.data;
        } else if (Array.isArray(foundType.categories)) {
          cats = foundType.categories;
        }

        setCategoriesList(cats);
        if (cats.length > 0) {
          setSelectedCategoryId(cats[0]._id);
          setEventType(cats[0].category || cats[0].eventType?.eventType || "");
        } else {
          setSelectedCategoryId("");
          setEventType("");
        }
      } catch (err) {
        if (Array.isArray(foundType.categories) && foundType.categories.length > 0) {
          setCategoriesList(foundType.categories);
          setSelectedCategoryId(foundType.categories[0]._id);
          setEventType(foundType.categories[0].category);
        } else {
          setCategoriesList([]);
          setSelectedCategoryId("");
          setEventType("");
        }
      }
    }
  };

  const calendarDays = useMemo(() => getCalendarDays(month), [month]);
  const activeIndex = steps.findIndex((item) => item.id === step);
  const visibleGuests = contacts.filter((guest) =>
    `${guest.name} ${guest.id} ${guest.email}`.toLowerCase().includes(guestSearch.toLowerCase())
  );

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await getAllUsersApi();
      if (response && response.status === true) {
        const serverUsers = Array.isArray(response.users) ? response.users : [];
        const mapped = serverUsers.map((u) => ({
          ...u,
          id: u._id || u.mobile, // Primary identifier: _id, fallback: mobile
          name: u.fullName || u.name || "",
          email: u.email || "",
          mobile: u.mobile || "",
          countryCode: u.countryCode || "+91",
          _id: u._id || "",
          profilePic: u.profilePic || null,
          invitation_sent: !!u.invitation_sent,
        }));

        // Preserve selected guests by matching them using _id or mobile
        setSelectedGuests((prevSelected) => {
          return prevSelected.map((selId) => {
            const matchedUser = mapped.find(
              (u) => (u._id && u._id === selId) || (u.mobile && u.mobile === selId)
            );
            if (matchedUser) {
              return matchedUser.id; // Map to the matched user's preferred ID
            }
            return selId;
          });
        });

        setContacts(mapped);
        try {
          window.localStorage.setItem("eventuna-contacts", JSON.stringify(mapped));
        } catch {
          // Ignore
        }
        return true;
      } else {
        throw new Error(response?.message || "Failed to fetch contacts from the server.");
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
      return false;
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    let hydrationTimer;
    try {
      const savedContacts = window.localStorage.getItem("eventuna-contacts");
      if (savedContacts) {
        const parsedContacts = JSON.parse(savedContacts);
        if (Array.isArray(parsedContacts)) {
          hydrationTimer = window.setTimeout(() => setContacts(parsedContacts), 0);
        }
      }
    } catch {
      // Keep the built-in contacts when browser storage is unavailable.
    }

    if (isLoggedIn()) {
      fetchContacts();
    }

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  // Auto-sync any unsynced local contacts on load
  useEffect(() => {
    if (!isLoggedIn() || contacts.length === 0) return;

    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
    const unsynced = contacts.filter((c) => !isValidObjectId(c.id || c._id));
    if (unsynced.length === 0) return;

    async function syncLocalContacts() {
      let updated = false;
      const updatedContacts = [...contacts];

      for (const contact of unsynced) {
        try {
          const res = await syncContactsApi({
            contacts: [
              {
                name: contact.name || "Guest",
                email: contact.email || "",
                mobile: contact.mobile || contact.id,
                countryCode: contact.countryCode || "+91",
              },
            ],
          });
          if (res && res.status && Array.isArray(res.contacts) && res.contacts[0]?._id) {
            const newId = res.contacts[0]._id;
            
            // Find and update the contact in our list
            const index = updatedContacts.findIndex((c) => c.id === contact.id);
            if (index !== -1) {
              updatedContacts[index] = {
                ...updatedContacts[index],
                id: newId,
                _id: newId,
              };
              updated = true;
            }
          }
        } catch (err) {
          console.error("Error auto-syncing local contact on load:", err);
        }
      }

      if (updated) {
        setContacts(updatedContacts);
        try {
          window.localStorage.setItem("eventuna-contacts", JSON.stringify(updatedContacts));
        } catch (e) {
          console.error(e);
        }
      }
    }

    syncLocalContacts();
  }, [contacts]);

  const saveContact = async () => {
    const name = newContact.name.trim();
    const phone = newContact.phone.trim();
    const email = newContact.email.trim();
    const countryCode = newContact.countryCode || "+91";

    if (!name || !phone) {
      setContactError("Name and phone number are required.");
      return;
    }
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
      setContactError("Enter a valid phone number.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactError("Enter a valid email address or leave it empty.");
      return;
    }
    if (contacts.some((contact) => contact.id === phone || contact.mobile === phone || contact._id === phone)) {
      setContactError("A contact with this phone number already exists.");
      return;
    }

    setIsSavingContact(true);
    setContactError("");

    try {
      if (isLoggedIn()) {
        const response = await syncContactsApi({
          contacts: [
            {
              name,
              email: email || "",
              mobile: phone,
              countryCode,
            },
          ],
        });

        if (!response || !response.status) {
          throw new Error(response?.message || "Failed to save contact on the server.");
        }

        const refreshSuccess = await fetchContacts();
        if (!refreshSuccess) {
          throw new Error("Contact was saved successfully, but the updated list could not be loaded from the server.");
        }
      } else {
        // Add contact locally
        const updatedContacts = [
          ...contacts,
          { id: phone, name, email, countryCode, mobile: phone },
        ];
        setContacts(updatedContacts);
        try {
          window.localStorage.setItem("eventuna-contacts", JSON.stringify(updatedContacts));
        } catch {
          // Keep in current session
        }
      }

      setNewContact({ name: "", phone: "", email: "", countryCode: "+91" });
      setContactError("");
      setContactModalOpen(false);
    } catch (err) {
      setContactError(err.message || "An error occurred while saving the contact.");
    } finally {
      setIsSavingContact(false);
    }
  };

  const submitEvent = async ({ saveDraft }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Required fields from current UI state
      formData.append("eventTitle", eventTitle);
      formData.append("eventDescription", invitationMessage);
      formData.append("eventTypeId", selectedEventTypeId);
      formData.append("eventCategoryId", selectedCategoryId);
      
      const formattedDate = `2026-${(month + 1).toString().padStart(2, "0")}-${selectedDate.toString().padStart(2, "0")}`;
      formData.append("eventDate", formattedDate);
      formData.append("eventStartTime", startTime);
      formData.append("eventEndTime", endTime);
      formData.append("bringalongGuest", bringGuests);
      formData.append("rvsp", rsvp);
      formData.append("saveDraft", saveDraft ? "true" : "false");

      // Optional fields - only append if they have values
      if (registryUrl.trim()) {
        formData.append("amazonGiftUrlId", registryUrl);
      }
      if (selectedRestaurant) {
        formData.append("merchantId", selectedRestaurant);
      }
      if (selectedLocation && selectedLocation._id) {
        formData.append("serviceLocationId", selectedLocation._id);
      }
      if (eventImageFile) {
        formData.append("image", eventImageFile);
      }
      const selectedPlaceOption = placePreferencesList.find((p) => p.preferences === place);
      if (selectedPlaceOption && selectedPlaceOption._id) {
        formData.append("placeId", selectedPlaceOption._id);
      }

      // Guest preferences details (appended conditionally if bringGuests is Yes or RSVP is Yes)
      if (bringGuests === "Yes" && maxGuests) {
        formData.append("bringalongGuestNumber", maxGuests);
      }
      if (rsvp === "Yes" && rsvpBy) {
        formData.append("rvspDateBy", rsvpBy);
      }

      // Array fields - JSON stringify if they have values
      const selectedNoteIds = eventNotesList
        .filter((item) => selectedNotes.includes(item.notes))
        .map((item) => item._id);
      if (selectedNoteIds.length > 0) {
        formData.append("noteIds", JSON.stringify(selectedNoteIds));
      }

      // Validate and automatically sync any guests that do not have a valid MongoDB ObjectId
      const finalSelectedGuests = [];
      const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

      for (const guestId of selectedGuests) {
        if (isValidObjectId(guestId)) {
          finalSelectedGuests.push(guestId);
        } else {
          // This guest is local-only (e.g. has a phone number as ID). Sync them first.
          const guestInfo = contacts.find((c) => c.id === guestId || c.mobile === guestId);
          const guestName = guestInfo ? guestInfo.name : "Unknown guest";
          if (guestInfo) {
            try {
              const syncRes = await syncContactsApi({
                contacts: [
                  {
                    name: guestInfo.name || "Guest",
                    email: guestInfo.email || "",
                    mobile: guestInfo.mobile || guestId,
                    countryCode: guestInfo.countryCode || "+91",
                  },
                ],
              });
              if (syncRes && syncRes.status && Array.isArray(syncRes.contacts) && syncRes.contacts[0]?._id) {
                const newDbId = syncRes.contacts[0]._id;
                finalSelectedGuests.push(newDbId);
                
                // Update contact details in the current list
                guestInfo.id = newDbId;
                guestInfo._id = newDbId;
                continue;
              }
            } catch (syncErr) {
              console.error("Error syncing guest on submission:", syncErr);
            }
          }
          throw new Error(`Guest "${guestName}" is not synced with the server. Please remove and re-add this contact.`);
        }
      }

      // Save updated contacts list with synced IDs
      setContacts([...contacts]);
      try {
        window.localStorage.setItem("eventuna-contacts", JSON.stringify(contacts));
      } catch (e) {
        console.error(e);
      }

      if (finalSelectedGuests.length > 0) {
        formData.append("contactListIds", JSON.stringify(finalSelectedGuests));
      }

      // Call API
      const response = await createEventApi(formData);

      if (!response || !response.status) {
        throw new Error(response?.message || "Failed to create event on the server.");
      }

      // Success: Save backend response to localStorage as source of truth
      const backendEvent = response.event || response.data || response.eventData || response.data?.event || response || {};
      const resolvedId = backendEvent._id || backendEvent.id || response._id || response.id || response.data?._id || response.data?.id || "";
      
      const resolvedEvent = {
        eventTitle: backendEvent.eventTitle || eventTitle,
        invitationMessage: backendEvent.eventDescription || invitationMessage,
        eventImage: backendEvent.imageUrl || eventImage, // backend uploaded URL if exists
        selectedDate: selectedDate,
        month: month,
        startTime: backendEvent.eventStartTime || startTime,
        endTime: backendEvent.eventEndTime || endTime,
        selectedRestaurant: backendEvent.merchantId || selectedRestaurant,
        selectedGuests: backendEvent.contactListIds || selectedGuests,
        bringGuests: backendEvent.bringalongGuest || bringGuests,
        maxGuests: backendEvent.bringalongGuestNumber || maxGuests,
        rsvp: backendEvent.rvsp || rsvp,
        rsvpBy: backendEvent.rvspDateBy || rsvpBy,
        selectedNotes: selectedNotes,
        registryUrl: backendEvent.amazonGiftUrlId || registryUrl,
        place: place,
        selectedLocation: selectedLocation,
        category: category,
        eventType: eventType,
        organizerName: "Takur",
        id: resolvedId
      };

      window.localStorage.setItem("eventuna-latest-event", JSON.stringify(resolvedEvent));
      if (resolvedId) {
        window.localStorage.setItem("eventuna-latest-event-id", resolvedId);
      }

      // Store created event ID and merchant name for the reservation modal
      setCreatedEventId(resolvedId);
      const selectedMerchant = merchantRestaurants.find((m) => m._id === selectedRestaurant || m._id === backendEvent.merchantId);
      setCreatedMerchantName(selectedMerchant?.serviceName || selectedMerchant?.name || "");

      setCompletionMode(saveDraft ? "draft" : "sent");
      setCompleted(true);

      // Automatically open the reservation modal if invitations were sent
      if (!saveDraft) {
        setResSuccess(false);
        setResError("");
        setResAdultCount("");
        setResInstruction("");
        setReservationModal(true);
      }
    } catch (err) {
      setDialog({
        title: "Submission failed",
        message: err.message || "An error occurred while creating the event. Please try again.",
        confirmLabel: "OK",
        onConfirm: () => setDialog(null),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakeReservation = async (e) => {
    if (e) e.preventDefault();
    if (!resAdultCount || isNaN(resAdultCount) || parseInt(resAdultCount) <= 0) {
      setResError("Please enter a valid number of guests.");
      return;
    }
    setResSubmitting(true);
    setResError("");
    setResSuccess(false);
    try {
      let eventIdVal = createdEventId || window.localStorage.getItem("eventuna-latest-event-id") || "";
      
      if (!eventIdVal) {
        try {
          const eventsRes = await getMyCreatedEventsApi();
          if (eventsRes && eventsRes.status === true && Array.isArray(eventsRes.data) && eventsRes.data.length > 0) {
            // Match by eventTitle if possible, otherwise use the first one (most recent)
            const matched = eventsRes.data.find(e => e.eventTitle === eventTitle) || eventsRes.data[0];
            if (matched && matched._id) {
              eventIdVal = matched._id;
              setCreatedEventId(matched._id);
              window.localStorage.setItem("eventuna-latest-event-id", matched._id);
            }
          }
        } catch (fetchErr) {
          console.error("Failed to fetch fallback created event ID:", fetchErr);
        }
      }

      if (!eventIdVal) {
        throw new Error("Event ID not found. Please try creating the event again.");
      }
      const payload = {
        eventId: eventIdVal,
        couponId: "",
        childCount: "",
        instruction: resInstruction,
        adultCount: String(resAdultCount),
        guestType: "Normal"
      };
      const res = await makeReservationApi(payload);
      if (res && res.status === true) {
        setResSuccess(true);
        setTimeout(() => {
          setReservationModal(false);
          router.push("/my-reservations");
        }, 1500);
      } else {
        throw new Error(res?.message || "Failed to save reservation.");
      }
    } catch (err) {
      setResError(err.message || "An error occurred. Please try again.");
    } finally {
      setResSubmitting(false);
    }
  };


  const openCancelDialog = () => setDialog({
    title: "Cancel event setup?",
    message: "Your event details have not been saved. All progress will be lost.",
    cancelLabel: "Keep editing",
    confirmLabel: "Exit setup",
    onConfirm: () => { window.location.href = "/"; },
  });

  const showInvalidTime = () => setDialog({
    title: "Invalid time",
    message: "End time must be greater than start time.",
    confirmLabel: "OK",
    onConfirm: () => setDialog(null),
  });

  const advance = () => {
    if (step === "date") {
      if (!startTime || !endTime || endTime <= startTime) {
        showInvalidTime();
        return;
      }
      setStep("category");
    } else if (step === "category") {
      setStep("place");
    } else if (step === "place") {
      const isRestaurantOption = place === "restaurant" || place === "Restaurant from list" || place === "6877a86668d1e0b9fcdf5006" || place === "Other participating facilities" || place === "facility" || place === "6877a87c68d1e0b9fcdf5010";
      if (place === "Private location") {
        if (subview !== "private-address") {
          setSubview("private-address");
          fetchSavedAddresses();
        } else if (selectedLocation) {
          setStep("guests");
          setSubview(null);
        }
      } else if (place === "Choose from map") {
        if (subview !== "map-selector") {
          setSubview("map-selector");
        } else if (selectedLocation) {
          setStep("guests");
          setSubview(null);
        }
      } else {
        setStep(isRestaurantOption ? "restaurants" : "guests");
      }
    } else if (step === "restaurants") {
      setStep("guests");
    } else if (step === "guests") {
      setStep("guestInfo");
    } else if (step === "guestInfo") setStep("registry");
    else if (step === "registry") setStep("notes");
    else if (step === "notes") setStep("content");
    else if (step === "content") {
      setStep("review");
      setIsEditingFromReview(false);
    }
  };

  const goBack = () => {
    if (subview === "add-private-address") {
      setSubview("private-address");
      return;
    }
    if (subview === "private-address" || subview === "map-selector") {
      setSubview(null);
      return;
    }
    if (subview) {
      setSubview(null);
      return;
    }
    const isRestaurantOption = place === "restaurant" || place === "Restaurant from list" || place === "6877a86668d1e0b9fcdf5006" || place === "Other participating facilities" || place === "facility" || place === "6877a87c68d1e0b9fcdf5010";
    if (step === "category") setStep("date");
    else if (step === "place") setStep("category");
    else if (step === "restaurants") setStep("place");
    else if (step === "guests") {
      if (place === "Private location") {
        setStep("place");
        setSubview("private-address");
      } else if (place === "Choose from map") {
        setStep("place");
        setSubview("map-selector");
      } else {
        setStep(isRestaurantOption ? "restaurants" : "place");
      }
    }
    else if (step === "guestInfo") setStep("guests");
    else if (step === "registry") setStep("guestInfo");
    else if (step === "notes") setStep("registry");
    else if (step === "content") setStep("notes");
    else if (step === "review") setStep("content");
  };

  const toggleGuest = (guestId) => {
    setSelectedGuests((current) =>
      current.includes(guestId) ? current.filter((id) => id !== guestId) : [...current, guestId]
    );
  };

  const markAllGuests = () => {
    const visibleIds = visibleGuests.map((guest) => guest.id);
    const allSelected = visibleIds.every((id) => selectedGuests.includes(id));
    setSelectedGuests((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const canContinue =
    (step !== "place" || Boolean(place)) &&
    (step !== "restaurants" || Boolean(selectedRestaurant)) &&
    (step !== "guestInfo" || (bringGuests === "No" || Boolean(maxGuests))) &&
    (step !== "guestInfo" || (rsvp === "No" || Boolean(rsvpBy))) &&
    (step !== "content" || (Boolean(eventTitle.trim()) && Boolean(invitationMessage.trim())));

  if (checkingAuth) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted fw-semibold">Checking authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="wrapper">
        <section className={styles.pageTitle}>
          <div className="container">
            <div>
              <span>Create and organize</span>
              <h1>Create Event</h1>
              <p>Set up your event details, venue, and guest preferences.</p>
            </div>
            <div className={styles.titleIcon}><i className="fa-solid fa-calendar-check"></i></div>
          </div>
        </section>

        <main className={styles.mainSection}>
          <div className="container">
            {completed ? (
              <section className={styles.successPanel}>
                <div className={styles.successIcon}><i className="fa-solid fa-check"></i></div>
                <span>{completionMode === "draft" ? "Draft saved" : "Invitations sent"}</span>
                <h2>{completionMode === "draft" ? "Your event draft is saved" : "Your event is ready"}</h2>
                <p style={{ color: "#5b5fc7", fontWeight: 500 }}>
                  {completionMode === "draft"
                    ? "You can continue editing this event from My Events."
                    : `Your event invitation has been sent${createdMerchantName ? ` selected Restaurant or Facility : ${createdMerchantName}` : ""}`}
                </p>
                <div className={styles.successActions}>
                  <a href="/event-details" className={styles.primaryButton}>View event details</a>
                  <a href="/my-events" className={styles.secondaryButton}>View my events</a>
                </div>
                {completionMode !== "draft" && (
                  <button
                    onClick={() => { setResSuccess(false); setResError(""); setResAdultCount(""); setResInstruction(""); setReservationModal(true); }}
                    style={{
                      marginTop: "28px",
                      width: "100%",
                      maxWidth: "340px",
                      background: "#5b5fc7",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "14px 0",
                      fontSize: "16px",
                      fontWeight: "700",
                      letterSpacing: "1.5px",
                      cursor: "pointer",
                      display: "block",
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    ADD RESERVATION
                  </button>
                )}
              </section>
            ) : (
              <div className={styles.wizard}>
                <aside className={styles.stepRail}>
                  <div className={styles.railHeading}>
                    <span>Event setup</span>
                    <strong>Step {activeIndex + 1} of {steps.length}</strong>
                  </div>
                  <ol>
                    {steps.map((item, index) => (
                      <li key={item.id} className={index === activeIndex ? styles.activeStep : index < activeIndex ? styles.finishedStep : ""}>
                        <span className={styles.stepIcon}><i className={`fa-solid ${index < activeIndex ? "fa-check" : item.icon}`}></i></span>
                        <span><strong>{item.label}</strong><small>{index < activeIndex ? "Completed" : index === activeIndex ? "In progress" : "Not started"}</small></span>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.railHelp}>
                    <i className="fa-regular fa-circle-question"></i>
                    <span><strong>Need help?</strong><small>Contact our event support team.</small></span>
                  </div>
                </aside>

                <section className={styles.wizardContent}>
                  <div className={styles.formHeader}>
                    <div>
                      <span>{subview ? "Venue information" : steps[activeIndex].label}</span>
                      <h2>{getViewTitle(step, subview)}</h2>
                      <p>{getViewDescription(step, subview)}</p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {(step !== "date" || subview) && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-2"
                          onClick={goBack}
                          style={{ fontSize: "14px", height: "38px" }}
                          title="Back to previous step"
                        >
                          <i className="fa-solid fa-arrow-left"></i>
                          <span>Back</span>
                        </button>
                      )}
                      <button className={styles.closeButton} onClick={openCancelDialog} aria-label="Cancel event setup">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>

                  <div className={styles.formBody}>
                    {step === "date" && (
                      <DateTimeStep
                        month={month}
                        setMonth={setMonth}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        calendarDays={calendarDays}
                        startTime={startTime}
                        setStartTime={setStartTime}
                        endTime={endTime}
                        setEndTime={setEndTime}
                      />
                    )}

                    {step === "category" && (
                      <div className={styles.fieldsGrid}>
                        <Field label="Event type" hint="Choose the event type that best describes your event.">
                          {loadingEventData ? (
                            <select disabled>
                              <option>Loading event types...</option>
                            </select>
                          ) : (
                            <select
                              value={selectedEventTypeId}
                              onChange={(event) => handleEventTypeChange(event.target.value)}
                            >
                              {eventTypesList.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.eventType}
                                </option>
                              ))}
                            </select>
                          )}
                        </Field>
                        <Field label="Event category" hint="Select the category for this event.">
                          {loadingEventData ? (
                            <select disabled>
                              <option>Loading event categories...</option>
                            </select>
                          ) : (
                            <select
                              value={selectedCategoryId}
                              onChange={(event) => {
                                const catId = event.target.value;
                                setSelectedCategoryId(catId);
                                const foundCat = categoriesList.find((c) => c._id === catId);
                                if (foundCat) {
                                  setEventType(foundCat.category || foundCat.eventType?.eventType || "");
                                }
                              }}
                            >
                              {categoriesList.length > 0 ? (
                                categoriesList.map((cat) => (
                                  <option key={cat._id} value={cat._id}>
                                    {cat.category}
                                  </option>
                                ))
                              ) : (
                                <option value="">No categories available</option>
                              )}
                            </select>
                          )}
                        </Field>
                      </div>
                    )}

                    {step === "place" && !subview && (
                      <div className={styles.optionList}>
                        {loadingPlaces ? (
                          <div className="text-center py-4 text-muted">
                            <i className="fa-solid fa-spinner fa-spin me-2"></i> Loading place options...
                          </div>
                        ) : placePreferencesList.length > 0 ? (
                          placePreferencesList.map((option) => {
                            const optionKey = option.preferences;
                            const isChecked = place === optionKey || place === option._id;
                            const detailsMap = {
                              "Private location": "Use a private venue or home address",
                              "I will give the address": "Enter the location details yourself",
                              "Choose from map": "Search and select a place on the map",
                              "Restaurant from list": "Choose a participating restaurant",
                              "Other participating facilities": "Browse other available event facilities",
                            };
                            const detailText = detailsMap[option.preferences] || "Select this location option for your event";

                            return (
                              <label key={option._id} className={isChecked ? styles.selectedOption : ""}>
                                <input
                                  type="radio"
                                  name="place"
                                  checked={isChecked}
                                  onChange={() => setPlace(optionKey)}
                                />
                                <span className={styles.optionCheck}>
                                  <i className="fa-solid fa-check"></i>
                                </span>
                                <span>
                                  <strong>{option.preferences}</strong>
                                  <small>{detailText}</small>
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="text-center py-4 text-muted">No place preferences available</div>
                        )}
                      </div>
                    )}

                    {step === "place" && subview === "private-address" && (
                      <PrivateAddressView
                        savedAddresses={savedAddresses}
                        selectedLocation={selectedLocation}
                        setSelectedLocation={setSelectedLocation}
                        isPrivateLocationCheckbox={isPrivateLocationCheckbox}
                        setIsPrivateLocationCheckbox={setIsPrivateLocationCheckbox}
                        onAddAddressClick={() => setSubview("add-private-address")}
                        onNext={advance}
                        loading={loadingAddresses}
                      />
                    )}

                    {step === "place" && subview === "map-selector" && (
                      <MapSelectorView
                        selectedLocation={selectedLocation}
                        setSelectedLocation={setSelectedLocation}
                        onSave={async (addressData) => {
                          setIsAddingAddress(true);
                          setAddAddressError("");
                          try {
                            const res = await addAddressApi(addressData);
                            if (res && res.status) {
                              const newAddr = res.address || res.data;
                              await fetchSavedAddresses();
                              if (newAddr && newAddr._id) {
                                newAddr.address = `${newAddr.address1 || ""}, ${newAddr.address2 || ""}, ${newAddr.postcode || ""}`.replace(/^,\s*|,\s*$/g, '');
                                setSelectedLocation(newAddr);
                              }
                              setStep("guests");
                              setSubview(null);
                            } else {
                              throw new Error(res?.message || "Failed to save address.");
                            }
                          } catch (err) {
                            setAddAddressError(err.message || "An error occurred while saving address.");
                          } finally {
                            setIsAddingAddress(false);
                          }
                        }}
                        onCancel={() => setSubview(null)}
                        error={addAddressError}
                        setError={setAddAddressError}
                        submitting={isAddingAddress}
                      />
                    )}

                    {step === "place" && subview === "add-private-address" && (
                      <AddPrivateAddressView
                        newPrivateAddress={newPrivateAddress}
                        setNewPrivateAddress={setNewPrivateAddress}
                        onAdd={handleAddPrivateAddress}
                        onCancel={() => setSubview("private-address")}
                        error={addAddressError}
                        submitting={isAddingAddress}
                      />
                    )}

                    {step === "restaurants" && !subview && (
                      <RestaurantList
                        restaurantsList={merchantRestaurants}
                        loading={loadingMerchants}
                        selectedRestaurant={selectedRestaurant}
                        setSelectedRestaurant={setSelectedRestaurant}
                        selectedLocation={selectedLocation}
                        setSelectedLocation={setSelectedLocation}
                        openDetail={(restaurant) => { setSelectedRestaurant(restaurant._id || restaurant.id); setSubview("detail"); }}
                        openLocations={(restaurant) => { setSelectedRestaurant(restaurant._id || restaurant.id); setSubview("locations"); }}
                        openSearch={() => setSubview("search")}
                        filterCoords={filterCoords}
                        setFilterCoords={setFilterCoords}
                        setPlaceSearch={setPlaceSearch}
                      />
                    )}
                    {step === "restaurants" && subview === "detail" && (
                      <RestaurantDetail
                        restaurant={
                          merchantRestaurants.find((item) => (item._id || item.id) === selectedRestaurant) ||
                          merchantRestaurants[0]
                        }
                      />
                    )}
                    {step === "restaurants" && subview === "locations" && (
                      <LocationsList
                        restaurant={
                          merchantRestaurants.find((item) => (item._id || item.id) === selectedRestaurant)
                        }
                        onSelect={(loc) => { setSelectedLocation(loc); setSubview(null); }}
                        selectedLocation={selectedLocation}
                      />
                    )}
                    {step === "restaurants" && subview === "search" && <PlaceSearch search={placeSearch} setSearch={setPlaceSearch} onSelect={(coords) => { setFilterCoords(coords); setSubview(null); }} />}

                    {step === "guests" && (
                      <GuestsStep
                        guests={visibleGuests}
                        search={guestSearch}
                        setSearch={setGuestSearch}
                        selectedGuests={selectedGuests}
                        toggleGuest={toggleGuest}
                        markAll={markAllGuests}
                        openAddContact={() => { setContactError(""); setContactModalOpen(true); }}
                        loading={loadingContacts}
                      />
                    )}

                    {step === "guestInfo" && (
                      <div className={styles.guestOptionsGrid}>
                        <Field label="Can guests bring someone?" hint="Allow each invitee to bring an additional guest.">
                          <select value={bringGuests} onChange={(event) => setBringGuests(event.target.value)}><option>No</option><option>Yes</option></select>
                        </Field>
                        {bringGuests === "Yes" && <Field label="Maximum additional guests" hint="Set the maximum number each invitee may bring."><input type="number" min="1" value={maxGuests} onChange={(event) => setMaxGuests(event.target.value)} placeholder="Maximum number" /></Field>}
                        <Field label="Is RSVP required?" hint="Ask invitees to confirm whether they will attend.">
                          <select value={rsvp} onChange={(event) => setRsvp(event.target.value)}><option>No</option><option>Yes</option></select>
                        </Field>
                        {rsvp === "Yes" && <Field label="RSVP deadline" hint="Choose the final date for guest responses."><input type="date" value={rsvpBy} onChange={(event) => setRsvpBy(event.target.value)} /></Field>}
                      </div>
                    )}

                    {step === "registry" && (
                      <div className={styles.registryPanel}>
                        <div className={styles.registryIcon}><i className="fa-brands fa-amazon"></i></div>
                        <div><span>Optional</span><h3>Amazon gift registry</h3><p>Add a registry link so guests can easily find your gift list.</p></div>
                        <Field label="Registry URL" hint="Paste your public Amazon gift registry URL."><input type="url" value={registryUrl} onChange={(event) => setRegistryUrl(event.target.value)} placeholder="https://amazon.com/registries/..." /></Field>
                        <a className={styles.outlineButton} href="https://www.amazon.com/registries" target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square"></i> Create a new registry</a>
                      </div>
                    )}

                    {step === "notes" && (
                      <NotesStep
                        notesList={eventNotesList}
                        loading={loadingNotes}
                        selectedNotes={selectedNotes}
                        setSelectedNotes={setSelectedNotes}
                        customNote={customNote}
                        setCustomNote={setCustomNote}
                      />
                    )}

                    {step === "content" && (
                      <div className={styles.contentFields}>
                        <Field label="Event title" hint="Use a clear title your guests will recognize."><input type="text" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Enter event title" maxLength="80" /></Field>
                        <label className={styles.field}><span>Invitation message</span><textarea value={invitationMessage} onChange={(event) => setInvitationMessage(event.target.value)} placeholder="Write your invitation message and important event details" rows="7"></textarea><small>{invitationMessage.length}/500 characters</small></label>
                      </div>
                    )}

                    {step === "review" && !subview && (
                      <ReviewStep
                        eventTitle={eventTitle}
                        invitationMessage={invitationMessage}
                        eventImage={eventImage}
                        setEventImage={setEventImage}
                        setEventImageFile={setEventImageFile}
                        selectedDate={selectedDate}
                        startTime={startTime}
                        endTime={endTime}
                        selectedRestaurant={selectedRestaurant}
                        selectedGuests={selectedGuests}
                        contacts={contacts}
                        bringGuests={bringGuests}
                        maxGuests={maxGuests}
                        rsvp={rsvp}
                        rsvpBy={rsvpBy}
                        selectedNotes={selectedNotes}
                        customNote={customNote}
                        registryUrl={registryUrl}
                        restaurants={merchantRestaurants}
                        month={month}
                        place={place}
                        selectedLocation={selectedLocation}
                        category={category}
                        eventType={eventType}
                        onViewDetail={() => setSubview("review-detail")}
                        onEditStep={(targetStep) => {
                          setStep(targetStep);
                          setIsEditingFromReview(true);
                        }}
                      />
                    )}

                    {step === "review" && subview === "review-detail" && (
                      <RestaurantDetail
                        restaurant={
                          merchantRestaurants.find((item) => (item._id || item.id) === selectedRestaurant) ||
                          merchantRestaurants[0]
                        }
                      />
                    )}
                  </div>

                  {subview !== "private-address" && subview !== "add-private-address" && (
                    <div className={styles.formActions}>
                    <button 
                      className={styles.secondaryButton} 
                      onClick={goBack} 
                      disabled={(step === "date" && !subview) || isSubmitting}
                    >
                      <i className="fa-solid fa-arrow-left"></i> Back
                    </button>
                    {!subview && step !== "review" && (
                      <div className="d-flex align-items-center gap-2">
                        {isEditingFromReview && (
                          <button
                            type="button"
                            className={styles.primaryButton}
                            style={{ background: "#10b981", borderColor: "#10b981" }}
                            onClick={() => {
                              setStep("review");
                              setIsEditingFromReview(false);
                            }}
                            disabled={!canContinue}
                          >
                            Save & Return to Review <i className="fa-solid fa-check-double"></i>
                          </button>
                        )}
                        <button className={styles.primaryButton} onClick={advance} disabled={!canContinue}>
                          Continue <i className="fa-solid fa-arrow-right"></i>
                        </button>
                      </div>
                    )}
                    {step === "review" && !subview && (
                      <div className={styles.reviewActions}>
                        <button 
                          className={styles.draftButton} 
                          onClick={() => submitEvent({ saveDraft: true })}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <><i className="fa-solid fa-spinner fa-spin me-2"></i>Saving...</>
                          ) : (
                            <><i className="fa-regular fa-floppy-disk"></i> Save draft</>
                          )}
                        </button>
                        <button 
                          className={styles.primaryButton} 
                          onClick={() => submitEvent({ saveDraft: false })}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <><i className="fa-solid fa-spinner fa-spin me-2"></i>Sending...</>
                          ) : (
                            <><i className="fa-regular fa-paper-plane"></i> Send invitations</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />

      {dialog && (
        <div className={styles.dialogBackdrop} role="presentation">
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className={styles.dialogIcon}><i className="fa-solid fa-triangle-exclamation"></i></div>
            <h2 id="dialog-title">{dialog.title}</h2>
            <p>{dialog.message}</p>
            <div className={styles.dialogActions}>
              {dialog.cancelLabel && <button className={styles.secondaryButton} onClick={() => setDialog(null)}>{dialog.cancelLabel}</button>}
              <button className={dialog.cancelLabel ? styles.dangerButton : styles.primaryButton} onClick={dialog.onConfirm}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div className={styles.dialogBackdrop} role="presentation">
          <div className={`${styles.dialog} ${styles.contactDialog}`} role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title">
            <div className={styles.contactDialogHeader}><div><span>Web app contacts</span><h2 id="contact-dialog-title">Add a new contact</h2><p>Save the contact first, then select them from the guest list.</p></div><button onClick={() => setContactModalOpen(false)} aria-label="Close contact form" disabled={isSavingContact}><i className="fa-solid fa-xmark"></i></button></div>
            <div className={styles.contactFields}>
              <Field label="Full name" hint="Required"><input autoFocus type="text" value={newContact.name} onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))} placeholder="Enter contact name" disabled={isSavingContact} /></Field>
              <Field label="Phone number" hint="Required">
                <div className="d-flex gap-2 align-items-center">
                  <div style={{ width: "95px", flexShrink: 0 }}>
                    <CountryCodePicker
                      value={newContact.countryCode || "+91"}
                      onChange={(code) => setNewContact((current) => ({ ...current, countryCode: code }))}
                      style={{
                        border: "1px solid #d5d8df",
                        background: "#fff",
                        borderRadius: "4px",
                        height: "46px",
                        transition: "all 0.2s ease-in-out",
                      }}
                      className="btn bg-white border-light-subtle d-flex align-items-center justify-content-center gap-2 w-100 shadow-sm"
                    />
                  </div>
                  <div className="flex-grow-1">
                    <input type="tel" value={newContact.phone} onChange={(event) => setNewContact((current) => ({ ...current, phone: event.target.value }))} placeholder="Enter phone number" disabled={isSavingContact} />
                  </div>
                </div>
              </Field>
              <Field label="Email address" hint="Optional"><input type="email" value={newContact.email} onChange={(event) => setNewContact((current) => ({ ...current, email: event.target.value }))} placeholder="Enter email if available" disabled={isSavingContact} /></Field>
              {contactError && <p className={styles.contactError}><i className="fa-solid fa-circle-exclamation"></i>{contactError}</p>}
            </div>
            <div className={styles.contactDialogActions}>
              <button className={styles.secondaryButton} onClick={() => setContactModalOpen(false)} disabled={isSavingContact}>Cancel</button>
              <button className={styles.primaryButton} onClick={saveContact} disabled={isSavingContact}>
                {isSavingContact ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                ) : (
                  <><i className="fa-solid fa-address-book"></i> Save contact</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {reservationModal && (
        <div className={styles.dialogBackdrop} role="presentation" style={{ background: "rgba(5, 2, 62, 0.65)" }}>
          <div className={`${styles.dialog} ${styles.contactDialog}`} role="dialog" aria-modal="true" style={{ maxWidth: "480px", borderRadius: "20px", overflow: "hidden" }}>
            <div className={styles.contactDialogHeader} style={{ padding: "20px 24px" }}>
              <div className="d-flex align-items-center gap-3">
                <button 
                  onClick={() => setReservationModal(false)} 
                  style={{ border: "none", background: "none", fontSize: "18px", color: "#333", cursor: "pointer", padding: 0 }}
                  aria-label="Back"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                  <h2 style={{ fontSize: "19px", fontWeight: "700", color: "#111", margin: 0 }}>Restaurant Reservation</h2>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleMakeReservation}>
              <div className={styles.contactFields} style={{ padding: "24px" }}>
                {/* Notice banner */}
                <div style={{
                  background: "#fff5f5",
                  border: "1px solid #ffe3e3",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  color: "#e53e3e",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  fontWeight: "500"
                }}>
                  Note : You are making reservation for yourself only as an invited guest. allow to bring others box is not checked, so only the account owner can attend
                </div>

                <div className="mb-4">
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#222", marginBottom: "8px" }}>
                    Only one ADULT seats is allowed to reserve
                  </label>
                  <input
                    type="number"
                    value={resAdultCount}
                    onChange={(e) => setResAdultCount(e.target.value)}
                    placeholder="Number"
                    required
                    min="1"
                    disabled={resSubmitting || resSuccess}
                    style={{
                      width: "100%",
                      height: "48px",
                      border: "1px solid #d5d8df",
                      borderRadius: "10px",
                      padding: "0 16px",
                      fontSize: "14px",
                      background: "#fff"
                    }}
                  />
                </div>

                <div className="mb-3">
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#222", marginBottom: "8px" }}>
                    Special Instruction
                  </label>
                  <textarea
                    value={resInstruction}
                    onChange={(e) => setResInstruction(e.target.value)}
                    placeholder="Message Details"
                    disabled={resSubmitting || resSuccess}
                    rows="4"
                    style={{
                      width: "100%",
                      border: "1px solid #d5d8df",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      background: "#fff",
                      resize: "none"
                    }}
                  />
                </div>

                {resError && (
                  <p className="text-danger small mt-2 mb-0 fw-medium">
                    <i className="fa-solid fa-circle-exclamation me-1"></i>
                    {resError}
                  </p>
                )}

                {resSuccess && (
                  <p className="text-success small mt-2 mb-0 fw-medium">
                    <i className="fa-solid fa-circle-check me-1"></i>
                    Reservation updated successfully. Redirecting...
                  </p>
                )}
              </div>

              <div style={{ padding: "0 24px 24px" }}>
                <button
                  type="submit"
                  disabled={resSubmitting || resSuccess}
                  style={{
                    width: "100%",
                    background: "#5b5fc7",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px 0",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {resSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Reserving...
                    </>
                  ) : (
                    "Restaurant Reservation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function getViewTitle(step, subview) {
  if (subview === "detail" || subview === "review-detail") return "Restaurant details";
  if (subview === "locations") return "Available locations";
  if (subview === "search") return "Search places";
  if (subview === "private-address") return "Event at private place";
  if (subview === "add-private-address") return "Add Address";
  if (subview === "map-selector") return "Select on Map";
  return {
    date: "When is your event?",
    category: "What kind of event is it?",
    place: "Where will the event take place?",
    restaurants: "Choose a participating restaurant",
    guests: "Who would you like to invite?",
    guestInfo: "Set guest preferences",
    registry: "Add a gift registry",
    notes: "Share important guest notes",
    content: "Write your invitation",
    review: "Review event details",
  }[step];
}

function getViewDescription(step, subview) {
  if (subview === "private-address") return "Confirm the event is at your private location and select a saved address.";
  if (subview === "add-private-address") return "Enter the details to save a new private address.";
  if (subview === "map-selector") return "Drag the map to place the pin exactly where your event will take place.";
  if (subview) return "Review the venue information before making your selection.";
  return {
    date: "Select the event date, start time, and end time.",
    category: "These details help guests understand the event at a glance.",
    place: "Choose the location option that works best for your event.",
    restaurants: "Select one venue or review its locations and details.",
    guests: "Search your contacts and select the people you want to invite.",
    guestInfo: "Decide how guests can respond and whether they can bring someone.",
    registry: "Connect an optional Amazon registry to your invitation.",
    notes: "Select helpful information guests should know before attending.",
    content: "Add the title and message guests will see on their invitation.",
    review: "Check every detail before sending invitations or saving a draft.",
  }[step];
}

function Field({ label, hint, children }) {
  return <label className={styles.field}><span>{label}</span>{children}<small>{hint}</small></label>;
}

function DateTimeStep({ month, setMonth, selectedDate, setSelectedDate, calendarDays, startTime, setStartTime, endTime, setEndTime }) {
  const monthName = new Date(2026, month, 1).toLocaleString("en-US", { month: "long" });
  return (
    <div className={styles.dateLayout}>
      <div className={styles.calendarPanel}>
        <div className={styles.monthControls}>
          <button onClick={() => setMonth((month + 11) % 12)} aria-label="Previous month"><i className="fa-solid fa-chevron-left"></i></button>
          <strong>{monthName} 2026</strong>
          <button onClick={() => setMonth((month + 1) % 12)} aria-label="Next month"><i className="fa-solid fa-chevron-right"></i></button>
        </div>
        <div className={styles.weekdays}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.calendarGrid}>{calendarDays.map((day, index) => <button key={`${day.number}-${index}`} className={`${day.outside ? styles.outsideDay : ""} ${!day.outside && day.number === selectedDate ? styles.selectedDay : ""}`} disabled={day.outside} onClick={() => setSelectedDate(day.number)}>{day.number}</button>)}</div>
      </div>
      <div className={styles.timePanel}>
        <div className={styles.timeHeading}><span><i className="fa-regular fa-clock"></i></span><div><strong>Time duration</strong><small>Choose an end time later than the start time.</small></div></div>
        <Field label="Start time" hint="When guests should arrive."><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
        <Field label="End time" hint="When the event is expected to finish."><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></Field>
        <div className={styles.dateSummary}><i className="fa-regular fa-calendar"></i><span><small>Selected date</small><strong>{monthName} {selectedDate}, 2026</strong></span></div>
      </div>
    </div>
  );
}

function RestaurantList({
  restaurantsList,
  loading,
  selectedRestaurant,
  setSelectedRestaurant,
  selectedLocation,
  setSelectedLocation,
  openDetail,
  openLocations,
  openSearch,
  filterCoords,
  setFilterCoords,
  setPlaceSearch
}) {
  const items = restaurantsList || [];
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [restaurantsList]);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-4">
        <button
          className={styles.locationFilter}
          style={{ flexGrow: 1 }}
          onClick={openSearch}
        >
          <i className="fa-solid fa-location-crosshairs"></i>
          <span>
            <small>Showing venues near</small>
            <strong>
              {filterCoords
                ? filterCoords.displayName.split(",").slice(0, 2).join(",")
                : "All Locations"}
            </strong>
          </span>
          <i className="fa-solid fa-chevron-down"></i>
        </button>
        {filterCoords && (
          <button
            type="button"
            className="btn btn-outline-danger btn-sm rounded-pill px-3.5 d-flex align-items-center"
            style={{
              height: "48px",
              fontSize: "13px",
              fontWeight: "600",
              borderColor: "#fee2e2",
              background: "#fef2f2",
              color: "#ef4444"
            }}
            onClick={() => {
              setFilterCoords(null);
              setPlaceSearch("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">
          <i className="fa-solid fa-spinner fa-spin fa-2x mb-2"></i>
          <div>Loading participating venues...</div>
        </div>
      ) : items.length > 0 ? (
        <>
          <div className={styles.restaurantList}>
            {currentItems.map((restaurant) => {
              const id = restaurant._id || restaurant.id;
              const name = restaurant.serviceName || restaurant.fullName || restaurant.name || "Venue";

              const isChecked = selectedRestaurant === id;
              const currentSelectedLoc = isChecked ? selectedLocation : null;

              const bestLoc = (restaurant.serviceLocationIds || []).find((loc) => {
                return loc.lat && loc.long;
              }) || (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]);

              const distanceStr = bestLoc && bestLoc.distance !== undefined
                ? `${bestLoc.distance.toFixed(1)} km away`
                : "";

              const locationStr =
                (currentSelectedLoc && (currentSelectedLoc.addressName || currentSelectedLoc.address)) ||
                (bestLoc && bestLoc.addressName) ||
                (bestLoc && bestLoc.address) ||
                restaurant.location ||
                "Location available";

              const imageSrc =
                restaurant.bannerImage ||
                restaurant.profileImage ||
                restaurant.image ||
                "/images/1.jpg";

              return (
                <article key={id} className={isChecked ? styles.selectedRestaurant : ""}>
                  <img
                    src={imageSrc}
                    alt={name}
                    width={92}
                    height={76}
                    style={{ objectFit: "cover", borderRadius: "8px" }}
                  />
                  <div className={styles.restaurantMeta}>
                    <strong>{name}</strong>
                    <span>
                      <i className="fa-solid fa-location-dot me-1"></i>
                      {locationStr}
                      {distanceStr && (
                        <span
                          className="badge bg-light text-primary border border-primary-subtle ms-2 px-2 py-1"
                          style={{ fontSize: "10.5px", fontWeight: "600", borderRadius: "6px" }}
                        >
                          {distanceStr}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.restaurantActions}>
                    <button type="button" onClick={() => openLocations(restaurant)}>
                      <i className="fa-solid fa-map-pin"></i> Locations
                    </button>
                    <button type="button" onClick={() => openDetail(restaurant)}>
                      <i className="fa-regular fa-eye"></i> Details
                    </button>
                  </div>
                  <label className={styles.selectVenue}>
                    <input
                      type="radio"
                      name="restaurant"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedRestaurant(id);
                        const firstLoc = restaurant.serviceLocationIds && restaurant.serviceLocationIds[0];
                        setSelectedLocation(firstLoc || null);
                      }}
                    />
                    <span>
                      <i className="fa-solid fa-check"></i>
                    </span>
                  </label>
                </article>
              );
            })}
          </div>

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div className="d-flex align-items-center justify-content-center gap-2 mt-4 flex-wrap">
              <button 
                type="button"
                className="btn btn-outline-primary rounded-pill px-3 py-1.5 d-flex align-items-center gap-1"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                style={{ fontSize: "13px", fontWeight: "600" }}
              >
                <i className="fa-solid fa-chevron-left"></i> Prev
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    className={`btn rounded-circle ${isActive ? 'btn-primary' : 'btn-light'} d-flex align-items-center justify-content-center`}
                    onClick={() => setCurrentPage(page)}
                    style={{ 
                      width: "34px", 
                      height: "34px", 
                      fontSize: "13px", 
                      fontWeight: isActive ? "700" : "500",
                      background: isActive ? "#3e56f0" : undefined,
                      borderColor: isActive ? "#3e56f0" : undefined,
                      color: isActive ? "#ffffff" : "#4b5563"
                    }}
                  >
                    {page}
                  </button>
                );
              })}

              <button 
                type="button"
                className="btn btn-outline-primary rounded-pill px-3 py-1.5 d-flex align-items-center gap-1"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                style={{ fontSize: "13px", fontWeight: "600" }}
              >
                Next <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-5 text-muted">No participating restaurants found.</div>
      )}
    </div>
  );
}

function RestaurantDetail({ restaurant }) {
  if (!restaurant) return null;
  const name = restaurant.serviceName || restaurant.fullName || restaurant.name || "Restaurant";
  const banner = restaurant.bannerImage || restaurant.profileImage || "/images/banner.jpg";
  const locationStr =
    (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.address) ||
    restaurant.location ||
    "Location details available";
  const phone = restaurant.phone || restaurant.mobile || "";
  const webUrl = restaurant.webUrl || "";
  const menuUrl = restaurant.menuUrl || "";
  const cuisine = restaurant.cuisineName || "";
  const description = restaurant.serviceDescription || restaurant.serviceSlogan || "Participating event venue.";
  const products = Array.isArray(restaurant.products) ? restaurant.products : [];

  return (
    <div className={styles.detailLayout}>
      <div className={styles.detailImage}>
        <img src={banner} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }} />
      </div>
      <div className={styles.detailInfo}>
        <span>Participating restaurant</span>
        <h3>{name}</h3>
        <p>{description}</p>
        {[
          ["fa-utensils", "Cuisine", cuisine],
          ["fa-location-dot", "Service location", locationStr],
          phone ? ["fa-phone", "Phone", phone] : null,
          webUrl ? ["fa-link", "Website", webUrl] : null,
          menuUrl ? ["fa-book-open", "Menu URL", menuUrl] : null,
        ].filter(Boolean).map(([icon, label, value]) => (
          <div className={styles.detailRow} key={label}>
            <i className={`fa-solid ${icon}`}></i>
            <span>
              <small>{label}</small>
              {label === "Website" || label === "Menu URL" ? (
                <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-primary text-decoration-none">
                  <strong>{value} <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i></strong>
                </a>
              ) : (
                <strong>{value}</strong>
              )}
            </span>
          </div>
        ))}

        {products.length > 0 && (
          <div className="mt-4 pt-3 border-top">
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-list-check text-primary"></i>
              Menu Items ({products.length})
            </h5>
            <div className="d-flex flex-column gap-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
              {products.map((prod) => {
                const img = prod.photo && prod.photo[0] && prod.photo[0].fileName ? prod.photo[0].fileName : null;
                const prodImg = img ? (img.startsWith("http") ? img : `https://event-una-image-bucket.s3.amazonaws.com/merchant/products/${img}`) : null;
                return (
                  <div key={prod._id} className="d-flex align-items-center gap-3 p-2 bg-light rounded border">
                    {prodImg && (
                      <img src={prodImg} alt={prod.name} width={48} height={48} style={{ objectFit: "cover", borderRadius: "6px" }} />
                    )}
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center">
                        <strong className="text-dark">{prod.name}</strong>
                        <span className="badge bg-primary fs-6">${prod.price}</span>
                      </div>
                      {prod.description && <small className="text-muted d-block">{prod.description}</small>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationsList({ restaurant, onSelect, selectedLocation }) {
  const locs = restaurant && restaurant.serviceLocationIds && restaurant.serviceLocationIds.length > 0
    ? restaurant.serviceLocationIds
    : locations.map((loc, idx) => ({ _id: idx, addressName: `Indore location ${idx + 1}`, address: loc }));

  return (
    <div className={styles.locationList}>
      {locs.map((location, index) => {
        const isSelected = selectedLocation && (selectedLocation._id === location._id || selectedLocation.address === location.address || (typeof location === "string" && selectedLocation === location));
        return (
          <button 
            key={location._id || index} 
            onClick={() => onSelect(location)}
            style={isSelected ? { background: "#eef0ff", borderLeft: "4px solid #3e56f0" } : undefined}
          >
            <span>
              <i className="fa-solid fa-location-dot"></i>
            </span>
            <div>
              <strong>{location.addressName || `Location ${index + 1}`}</strong>
              <small>{location.address || location}</small>
            </div>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        );
      })}
    </div>
  );
}

function PlaceSearch({ search, setSearch, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=5&addressdetails=1`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
        }
      } catch (err) {
        console.error("Nominatim search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  return (
    <div>
      <div className={styles.searchBox}>
        <i className="fa-solid fa-magnifying-glass"></i>
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a city, address, or landmark"
        />
        {loading && (
          <span className="me-2">
            <i className="fa-solid fa-spinner fa-spin text-muted"></i>
          </span>
        )}
        {search && (
          <button onClick={() => setSearch("")} aria-label="Clear search">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
      <div className={styles.searchResults}>
        {suggestions.length > 0 ? (
          suggestions.map((item, idx) => {
            const name = item.address?.neighbourhood || item.address?.suburb || item.address?.road || item.address?.city || item.address?.town || item.name || "Location";
            const details = item.display_name;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelect({
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                  displayName: item.display_name
                })}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  textAlign: "left",
                  border: "none",
                  background: "none",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <i className="fa-solid fa-location-dot text-muted"></i>
                <span className="d-flex flex-column text-start">
                  <strong style={{ fontSize: "14px", color: "#1f2937" }}>{name}</strong>
                  <small style={{ fontSize: "12px", color: "#6b7280" }}>{details}</small>
                </span>
              </button>
            );
          })
        ) : search.trim().length >= 3 && !loading ? (
          <div className="text-center py-4 text-muted small">No places found matching search.</div>
        ) : null}
      </div>
    </div>
  );
}

function NotesStep({ notesList, loading, selectedNotes, setSelectedNotes, customNote, setCustomNote }) {
  const toggleNote = (noteText) => {
    setSelectedNotes((current) =>
      current.includes(noteText) ? current.filter((item) => item !== noteText) : [...current, noteText]
    );
  };

  return (
    <div className={styles.notesLayout}>
      {loading ? (
        <div className="text-center py-4 text-muted">
          <i className="fa-solid fa-spinner fa-spin me-2"></i> Loading event notes from API...
        </div>
      ) : notesList && notesList.length > 0 ? (
        <div className={styles.notesList}>
          {notesList.map((item) => {
            const text = item.notes;
            const isChecked = selectedNotes.includes(text);
            return (
              <label key={item._id}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleNote(text)}
                />
                <span className={styles.noteCheck}>
                  <i className="fa-solid fa-check"></i>
                </span>
                <span>
                  <strong>{text}</strong>
                  <small>Include this note in the event invitation.</small>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-muted">No notes options available</div>
      )}
    </div>
  );
}

function ReviewStep({ eventTitle, invitationMessage, eventImage, setEventImage, setEventImageFile, selectedDate, startTime, endTime, selectedRestaurant, selectedGuests, contacts, bringGuests, maxGuests, rsvp, rsvpBy, selectedNotes, customNote, registryUrl, restaurants, month, place, selectedLocation, category, eventType, onViewDetail, onEditStep }) {
  const restaurant = Array.isArray(restaurants) ? restaurants.find((item) => (item._id || item.id) === selectedRestaurant) : null;
  const invitedGuests = contacts.filter((guest) => selectedGuests.includes(guest.id));
  const allNotes = [...selectedNotes, ...(customNote.trim() ? [customNote.trim()] : [])];
  
  const monthName = new Date(2026, month, 1).toLocaleString("en-US", { month: "long" });

  const isRestaurantOption = place === "At a participating restaurant" || 
                             place === "restaurant" || 
                             place === "Restaurant from list" || 
                             place === "6877a86668d1e0b9fcdf5006";

  let venueDisplay = "Location provided by organizer";
  if (isRestaurantOption) {
    if (restaurant) {
      const restName = restaurant.serviceName || restaurant.fullName || restaurant.name || "Participating restaurant";
      if (selectedLocation) {
        venueDisplay = `${restName} - ${selectedLocation.addressName || selectedLocation.address}`;
      } else {
        const defaultLoc = (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.addressName) || 
                           (restaurant.serviceLocationIds && restaurant.serviceLocationIds[0]?.address) || 
                           restaurant.location;
        venueDisplay = defaultLoc ? `${restName} (${defaultLoc})` : restName;
      }
    } else {
      venueDisplay = "Participating restaurant";
    }
  } else if (place === "Private location" && selectedLocation) {
    venueDisplay = `${selectedLocation.addressName || "Private Address"}: ${selectedLocation.address1 || ""}, ${selectedLocation.address2 || ""}, ${selectedLocation.postcode || ""}`.replace(/,\s*$/, "");
  } else if (place) {
    venueDisplay = place;
  }

  return (
    <div className={styles.reviewLayout}>
      <section className={styles.reviewPrimary}>
        <label className={styles.uploadArea} style={eventImage ? { backgroundImage: `url(${eventImage})` } : undefined}>
          <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setEventImage(URL.createObjectURL(file)); if (setEventImageFile) setEventImageFile(file); } }} />
          <span><i className="fa-solid fa-cloud-arrow-up"></i><strong>{eventImage ? "Change event image" : "Upload event image"}</strong><small>Recommended size: 1200 x 675 px</small></span>
        </label>
        <div className={styles.reviewTitle}>
          <div className="d-flex justify-content-between align-items-center">
            <span>Event preview • {category} ({eventType})</span>
            <button 
              type="button" 
              onClick={() => onEditStep("category")} 
              className="btn btn-link text-decoration-none p-0 text-primary fw-semibold"
              style={{ fontSize: "11px" }}
            >
              <i className="fa-solid fa-pen-to-square me-1"></i>Edit Category
            </button>
          </div>
          <div className="d-flex justify-content-between align-items-start mt-2">
            <h3 className="m-0 flex-grow-1">{eventTitle || "Untitled event"}</h3>
            <button 
              type="button" 
              onClick={() => onEditStep("content")} 
              className="btn btn-link text-decoration-none p-0 text-primary ms-3"
              style={{ fontSize: "14px" }}
              title="Edit title and invitation message"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
          <p className="mt-2">{invitationMessage || "No invitation message added."}</p>
          {isRestaurantOption && restaurant && (
            <button
              type="button"
              className="btn btn-primary rounded-pill py-2.5 px-4 mt-3 fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2"
              onClick={onViewDetail}
              style={{ background: "#4f46e5", border: "none", fontSize: "14px", width: "fit-content" }}
            >
              <i className="fa-solid fa-circle-info"></i>
              Venue Details
            </button>
          )}
        </div>
        <div className={styles.reviewFacts}>
          <div style={{ position: "relative", paddingRight: "40px" }}>
            <i className="fa-regular fa-calendar"></i>
            <span>
              <small>Date and time</small>
              <strong>{monthName} {selectedDate}, 2026 | {startTime || "--:--"} - {endTime || "--:--"}</strong>
            </span>
            <button 
              type="button" 
              onClick={() => onEditStep("date")} 
              className="btn btn-link text-decoration-none p-0 text-primary position-absolute end-0 top-50 translate-middle-y me-3"
              title="Edit date and time"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
          <div style={{ position: "relative", paddingRight: "40px" }}>
            <i className="fa-solid fa-location-dot"></i>
            <span>
              <small>Venue</small>
              <strong>{venueDisplay}</strong>
            </span>
            <button 
              type="button" 
              onClick={() => onEditStep("place")} 
              className="btn btn-link text-decoration-none p-0 text-primary position-absolute end-0 top-50 translate-middle-y me-3"
              title="Edit venue / location preference"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
          <div style={{ position: "relative", paddingRight: "40px" }}>
            <i className="fa-solid fa-user-plus"></i>
            <span>
              <small>Additional guests</small>
              <strong>{bringGuests === "Yes" ? `Allowed, maximum ${maxGuests || 1}` : "Not allowed"}</strong>
            </span>
            <button 
              type="button" 
              onClick={() => onEditStep("guestInfo")} 
              className="btn btn-link text-decoration-none p-0 text-primary position-absolute end-0 top-50 translate-middle-y me-3"
              title="Edit guest options"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
          <div style={{ position: "relative", paddingRight: "40px" }}>
            <i className="fa-regular fa-calendar-check"></i>
            <span>
              <small>RSVP</small>
              <strong>{rsvp === "Yes" ? `Required${rsvpBy ? ` by ${rsvpBy}` : ""}` : "Not required"}</strong>
            </span>
            <button 
              type="button" 
              onClick={() => onEditStep("guestInfo")} 
              className="btn btn-link text-decoration-none p-0 text-primary position-absolute end-0 top-50 translate-middle-y me-3"
              title="Edit RSVP options"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
          </div>
        </div>
      </section>
      <aside className={styles.reviewSummary}>
        <div className={styles.summaryBlock}>
          <div className={styles.summaryHeading}>
            <strong>Guests ({invitedGuests.length})</strong>
            <div className="d-flex align-items-center gap-2">
              <button 
                type="button" 
                onClick={() => onEditStep("guests")} 
                className="btn btn-link text-decoration-none p-0 text-primary fw-semibold"
                style={{ fontSize: "11px" }}
              >
                Edit
              </button>
              {invitedGuests.length > 4 && (
                <>
                  <span className="text-muted" style={{ fontSize: "9px" }}>|</span>
                  <button 
                    type="button"
                    onClick={() => onEditStep("guests")}
                    className="btn btn-link text-decoration-none p-0 text-primary fw-semibold"
                    style={{ fontSize: "11px" }}
                  >
                    View all
                  </button>
                </>
              )}
            </div>
          </div>
          {invitedGuests.length ? (
            <div className={styles.guestAvatars}>
              {invitedGuests.slice(0, 4).map((guest) => (
                <div key={guest.id}>
                  <span>{guest.name.slice(0, 1)}</span>
                  <small>{guest.name}</small>
                </div>
              ))}
            </div>
          ) : (
            <p>No guests selected.</p>
          )}
        </div>
        <div className={styles.summaryBlock}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <strong>Selected notes</strong>
            <button 
              type="button" 
              onClick={() => onEditStep("notes")} 
              className="btn btn-link text-decoration-none p-0 text-primary fw-semibold"
              style={{ fontSize: "11px" }}
            >
              <i className="fa-solid fa-pen-to-square me-1"></i>Edit
            </button>
          </div>
          {allNotes.length ? (
            <ul>
              {allNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p>No notes selected.</p>
          )}
        </div>
        <div className={styles.summaryBlock}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <strong>Gift registry</strong>
            <button 
              type="button" 
              onClick={() => onEditStep("registry")} 
              className="btn btn-link text-decoration-none p-0 text-primary fw-semibold"
              style={{ fontSize: "11px" }}
            >
              <i className="fa-solid fa-pen-to-square me-1"></i>Edit
            </button>
          </div>
          <p>{registryUrl || "No gift registry added."}</p>
        </div>
        <div className={styles.summaryBlock}>
          <strong>Additional services</strong>
          <p>Furniture rentals</p>
        </div>
      </aside>
    </div>
  );
}

function GuestsStep({ guests: guestResults, search, setSearch, selectedGuests, toggleGuest, markAll, openAddContact, loading }) {
  return (
    <div>
      <div className={styles.contactsIntro}>
        <div>
          <strong>Saved contacts</strong>
          <span>Add people to your web app contacts before assigning them to this event.</span>
        </div>
        <button className={styles.addContactButton} onClick={openAddContact}>
          <i className="fa-solid fa-user-plus"></i> Add contact
        </button>
      </div>
      <div className={styles.guestToolbar}>
        <div className={styles.searchBox}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, phone, or email"
          />
        </div>
        <button onClick={markAll}>Select all</button>
      </div>
      {loading ? (
        <div className="text-center py-5 text-muted">
          <i className="fa-solid fa-spinner fa-spin fa-2x mb-2 text-primary"></i>
          <div>Loading contacts from server...</div>
        </div>
      ) : (
        <>
          <div className={styles.guestList}>
            {guestResults.map((guest) => (
              <label key={guest.id}>
                <span className={styles.avatar}>
                  {guest.profilePic ? (
                    <img
                      src={guest.profilePic}
                      alt={guest.name}
                      width={38}
                      height={38}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    guest.name.slice(0, 1)
                  )}
                </span>
                <span className={styles.guestMeta}>
                  <strong>{guest.name}</strong>
                  <small>
                    {guest.mobile || guest.id}
                    {guest.email && ` | ${guest.email}`}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={selectedGuests.includes(guest.id)}
                  onChange={() => toggleGuest(guest.id)}
                />
                <span className={styles.guestCheck}>
                  <i className="fa-solid fa-check"></i>
                </span>
              </label>
            ))}
          </div>
          {!guestResults.length && (
            <div className={styles.emptyState}>
              <i className="fa-regular fa-user"></i>
              <strong>No contacts found</strong>
              <span>Add a new contact or try another search.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrivateAddressView({
  savedAddresses,
  selectedLocation,
  setSelectedLocation,
  isPrivateLocationCheckbox,
  setIsPrivateLocationCheckbox,
  onAddAddressClick,
  onNext,
  loading
}) {
  return (
    <div className="mx-auto" style={{ maxWidth: "480px", padding: "10px" }}>
      <div className="mb-4 d-flex align-items-center gap-2.5">
        <label className="d-flex align-items-center gap-2 cursor-pointer w-100">
          <input
            type="checkbox"
            checked={isPrivateLocationCheckbox}
            onChange={(e) => setIsPrivateLocationCheckbox(e.target.checked)}
            style={{ width: "20px", height: "20px", cursor: "pointer" }}
            className="form-check-input mt-0"
          />
          <span style={{ fontSize: "14.5px", color: "#374151", fontWeight: "500" }}>The event is my private location</span>
        </label>
      </div>

      <div className="mb-4">
        <label className="form-label text-dark fw-bold mb-2.5" style={{ fontSize: "15px" }}>
          Select Saved Address
        </label>
        {loading ? (
          <div className="text-center py-4 text-muted">
            <i className="fa-solid fa-spinner fa-spin me-2"></i> Loading saved addresses...
          </div>
        ) : savedAddresses.length > 0 ? (
          <div className="position-relative">
            <select
              value={selectedLocation ? selectedLocation._id : ""}
              onChange={(e) => {
                const matched = savedAddresses.find(addr => addr._id === e.target.value);
                setSelectedLocation(matched || null);
              }}
              className="form-select border-light-subtle shadow-sm px-3.5"
              style={{
                width: "100%",
                height: "50px",
                borderRadius: "10px",
                fontSize: "14px",
                background: "#fff",
                appearance: "none",
                borderColor: "#e5e7eb"
              }}
            >
              {savedAddresses.map((addr) => (
                <option key={addr._id} value={addr._id}>
                  {addr.addressName} ({addr.address1}, {addr.address2})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-muted small">No saved addresses found.</p>
        )}
      </div>

      <div className="mb-5">
        <button
          type="button"
          onClick={onAddAddressClick}
          className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1.5 fw-semibold"
          style={{
            color: "#3e56f0",
            fontSize: "14.5px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "18px" }}>+</span> Add New Address
        </button>
      </div>

      <div style={{ marginTop: "40px" }}>
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedLocation}
          className="btn btn-primary rounded-pill py-3 fw-bold w-100 text-white"
          style={{
            background: "#5b5fc7",
            border: "none",
            fontSize: "15px",
            boxShadow: "0 4px 12px rgba(91, 95, 199, 0.2)"
          }}
        >
          NEXT
        </button>
      </div>
    </div>
  );
}

function AddPrivateAddressView({
  newPrivateAddress,
  setNewPrivateAddress,
  onAdd,
  onCancel,
  error,
  submitting
}) {
  return (
    <div className="mx-auto" style={{ maxWidth: "480px", padding: "10px" }}>
      <div className="mb-3">
        <label className="form-label text-dark fw-bold mb-1.5" style={{ fontSize: "14px" }}>
          Address Name
        </label>
        <input
          type="text"
          value={newPrivateAddress.addressName}
          onChange={(e) => setNewPrivateAddress(prev => ({ ...prev, addressName: e.target.value }))}
          placeholder="Address"
          className="form-control border-light-subtle shadow-sm px-3.5"
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "10px",
            fontSize: "14px",
            borderColor: "#e5e7eb"
          }}
        />
      </div>

      <div className="mb-3">
        <label className="form-label text-dark fw-bold mb-1.5" style={{ fontSize: "14px" }}>
          Address 1
        </label>
        <input
          type="text"
          value={newPrivateAddress.address1}
          onChange={(e) => setNewPrivateAddress(prev => ({ ...prev, address1: e.target.value }))}
          placeholder="Flat No. House"
          className="form-control border-light-subtle shadow-sm px-3.5"
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "10px",
            fontSize: "14px",
            borderColor: "#e5e7eb"
          }}
        />
      </div>

      <div className="mb-3">
        <label className="form-label text-dark fw-bold mb-1.5" style={{ fontSize: "14px" }}>
          Address 2
        </label>
        <input
          type="text"
          value={newPrivateAddress.address2}
          onChange={(e) => setNewPrivateAddress(prev => ({ ...prev, address2: e.target.value }))}
          placeholder="Locality"
          className="form-control border-light-subtle shadow-sm px-3.5"
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "10px",
            fontSize: "14px",
            borderColor: "#e5e7eb"
          }}
        />
      </div>

      <div className="mb-4">
        <label className="form-label text-dark fw-bold mb-1.5" style={{ fontSize: "14px" }}>
          Post Code
        </label>
        <input
          type="text"
          value={newPrivateAddress.postcode}
          onChange={(e) => setNewPrivateAddress(prev => ({ ...prev, postcode: e.target.value }))}
          placeholder="Post Code"
          className="form-control border-light-subtle shadow-sm px-3.5"
          style={{
            width: "100%",
            height: "48px",
            borderRadius: "10px",
            fontSize: "14px",
            borderColor: "#e5e7eb"
          }}
        />
      </div>

      {error && (
        <div className="alert alert-danger py-2 px-3 small border-0 shadow-sm d-flex align-items-center gap-2 mb-4" style={{ borderRadius: "8px" }}>
          <i className="fa-solid fa-circle-exclamation text-danger"></i>
          <span className="fw-medium text-danger">{error}</span>
        </div>
      )}

      <div className="d-flex gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn btn-outline-secondary rounded-pill py-2.5 fw-bold flex-grow-1 border-light-subtle"
          style={{ fontSize: "14px", background: "#f9fafb" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={submitting}
          className="btn btn-primary rounded-pill py-2.5 fw-bold flex-grow-1 text-white"
          style={{
            background: "#5b5fc7",
            border: "none",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(91, 95, 199, 0.2)"
          }}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-1.5" role="status" aria-hidden="true"></span>
              Adding...
            </>
          ) : (
            "ADD"
          )}
        </button>
      </div>
    </div>
  );
}

function MapSelectorView({
  selectedLocation,
  setSelectedLocation,
  onSave,
  onCancel,
  error,
  setError,
  submitting
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addressData, setAddressData] = useState({
    addressName: "",
    address1: "",
    address2: "",
    postcode: ""
  });
  const [mapInstance, setMapInstance] = useState(null);
  const [markerInstance, setMarkerInstance] = useState(null);
  const [isAddressSelectedCheckbox, setIsAddressSelectedCheckbox] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.L) return;
    const L = window.L;

    // Patna, Bihar coordinates as default
    const initialLat = 25.5941;
    const initialLng = 85.1376;

    const map = L.map("map-view-selector", {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: customIcon
    }).addTo(map);

    setMapInstance(map);
    setMarkerInstance(marker);

    // Fetch initial details
    updateAddressFromCoords(initialLat, initialLng, marker, L);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      updateAddressFromCoords(pos.lat, pos.lng, marker, L);
    });

    return () => {
      map.remove();
    };
  }, []);

  const updateAddressFromCoords = async (lat, lng, marker, L) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const addressName = addr.neighbourhood || addr.suburb || addr.road || addr.village || addr.industrial || addr.commercial || "Location Select";
        const address1 = addr.city || addr.town || addr.county || addr.state_district || "";
        const address2 = addr.state || addr.region || "";
        const postcode = addr.postcode || "000000";

        setAddressData({
          addressName,
          address1,
          address2,
          postcode
        });

        const fullStr = data.display_name || `${addressName}, ${address1}, ${address2}`;
        setSearchQuery(fullStr);
        if (marker && L) {
          marker.bindPopup(`<b>${addressName}</b><br/>${address1}, ${address2}`).openPopup();
        }
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    }
  };

  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    
    if (mapInstance && markerInstance) {
      mapInstance.setView([lat, lon], 15);
      markerInstance.setLatLng([lat, lon]);
      
      const addr = item.address || {};
      const addressName = addr.neighbourhood || addr.suburb || addr.road || addr.village || addr.industrial || addr.commercial || item.name || "Location Select";
      const address1 = addr.city || addr.town || addr.county || addr.state_district || "";
      const address2 = addr.state || addr.region || "";
      const postcode = addr.postcode || "000000";

      setAddressData({
        addressName,
        address1,
        address2,
        postcode
      });

      setSearchQuery(item.display_name);
      setSuggestions([]);
      
      if (window.L) {
        markerInstance.bindPopup(`<b>${addressName}</b><br/>${address1}, ${address2}`).openPopup();
      }
    }
  };

  const handleNext = () => {
    if (!addressData.addressName || !addressData.address1 || !addressData.address2 || !addressData.postcode) {
      setError("Please select a location with complete details.");
      return;
    }
    onSave(addressData);
  };

  return (
    <div className="mx-auto" style={{ maxWidth: "480px", padding: "10px" }}>
      <div className="mb-3 position-relative">
        <div className="form-check mb-3 bg-white p-3 rounded-3 shadow-sm border border-light-subtle d-flex align-items-center gap-2" style={{ borderColor: "#e5e7eb" }}>
          <input
            className="form-check-input ms-0 mt-0"
            type="checkbox"
            id="selectAddressCheckbox"
            checked={isAddressSelectedCheckbox}
            onChange={(e) => setIsAddressSelectedCheckbox(e.target.checked)}
            style={{ width: "20px", height: "20px", cursor: "pointer" }}
          />
          <label className="form-check-label fw-semibold text-dark cursor-pointer ms-2" htmlFor="selectAddressCheckbox" style={{ fontSize: "14px" }}>
            I will Select address
          </label>
        </div>

        {isAddressSelectedCheckbox && (
          <div className="position-relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search address..."
              className="form-control border-light-subtle shadow-sm px-3.5"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "10px",
                fontSize: "14px",
                borderColor: "#e5e7eb",
                paddingRight: "40px"
              }}
            />
            {loadingSuggestions && (
              <span className="position-absolute end-0 top-50 translate-middle-y me-3">
                <i className="fa-solid fa-spinner fa-spin text-muted"></i>
              </span>
            )}
            
            {suggestions.length > 0 && (
              <ul className="dropdown-menu show position-absolute w-100 p-0 shadow-lg border border-light-subtle" style={{ maxHeight: "200px", overflowY: "auto", top: "100%", zIndex: 10000, display: "block" }}>
                {suggestions.map((item, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="dropdown-item py-2.5 px-3 d-flex align-items-center text-wrap text-start border-bottom border-light-subtle"
                      style={{ fontSize: "13px", gap: "8px", borderBottom: "1px solid #f3f4f6" }}
                    >
                      <i className="fa-solid fa-location-dot text-muted"></i>
                      <span>{item.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mb-3">
        <div
          id="map-view-selector"
          style={{
            height: "350px",
            width: "100%",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            position: "relative",
            zIndex: 10
          }}
        ></div>
        <p className="text-muted small mt-2 text-center">
          <i className="fa-solid fa-circle-info me-1"></i> Drag the map marker to place the pin exactly where your event will take place.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger py-2 px-3 small border-0 shadow-sm d-flex align-items-center gap-2 mb-4" style={{ borderRadius: "8px" }}>
          <i className="fa-solid fa-circle-exclamation text-danger"></i>
          <span className="fw-medium text-danger">{error}</span>
        </div>
      )}

      <div className="d-flex gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn btn-outline-secondary rounded-pill py-2.5 fw-bold flex-grow-1 border-light-subtle"
          style={{ fontSize: "14px", background: "#f9fafb" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="btn btn-primary rounded-pill py-2.5 fw-bold flex-grow-1 text-white"
          style={{
            background: "#5b5fc7",
            border: "none",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(91, 95, 199, 0.2)"
          }}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-1.5" role="status" aria-hidden="true"></span>
              Saving...
            </>
          ) : (
            "NEXT"
          )}
        </button>
      </div>
    </div>
  );
}
