import { Address, ipfs, json } from "@graphprotocol/graph-ts";
import {
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP,
} from "../generated/Web3RSVP/Web3RSVP";
import { Account, RSVP, Confirmation, Event } from "../generated/schema";
import { integer } from "@protofire/subgraph-toolkit";

const getAttendeeAccount = (attendeeAddress: Address): Account => {
  let attendeeAccount = Account.load(attendeeAddress.toHex());
  if (!attendeeAccount) {
    attendeeAccount = new Account(attendeeAddress.toHex());
    attendeeAccount.totalRSVPs = integer.ZERO;
    attendeeAccount.totalAttendedEvents = integer.ZERO;
    attendeeAccount.save();
  }
  return attendeeAccount;
};

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {
  const id =
    event.params.eventId.toHex() + event.params.attendeeAddress.toHex();
  const attendeeAccount = getAttendeeAccount(event.params.attendeeAddress);
  const thisEvent = Event.load(event.params.eventId.toHex());

  let newConfirmation = Confirmation.load(id);

  if (!newConfirmation && thisEvent) {
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = attendeeAccount.id;
    newConfirmation.event = thisEvent.id;
    newConfirmation.save();

    thisEvent.totalConfirmedAttendees = integer.increment(
      thisEvent.totalConfirmedAttendees
    );
    thisEvent.save();

    attendeeAccount.totalAttendedEvents = integer.increment(
      attendeeAccount.totalAttendedEvents
    );
    attendeeAccount.save();
  }
}

export function handleDepositsPaidOut(event: DepositsPaidOut): void {
  let thisEvent = Event.load(event.params.eventId.toHex());
  if (thisEvent) {
    thisEvent.paidOut = true;
    thisEvent.save();
  }
}

export function handleNewEventCreated(event: NewEventCreated): void {
  let newEvent = Event.load(event.params.eventId.toHex());
  if (!newEvent) {
    newEvent = new Event(event.params.eventId.toHex());
    newEvent.eventID = event.params.eventId;
    newEvent.eventOwner = event.params.creatorAddress;
    newEvent.eventTimestamp = event.params.eventTimestamp;
    newEvent.maxCapacity = event.params.maxCapacity;
    newEvent.deposit = event.params.deposit;
    newEvent.paidOut = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendees = integer.ZERO;

    const metadata = ipfs.cat(event.params.eventDataCID + "/data.json");

    if (metadata) {
      const value = json.fromBytes(metadata).toObject();
      if (value) {
        const name = value.get("name");
        const description = value.get("description");
        const link = value.get("link");
        const imagePath = value.get("image");

        if (name) newEvent.name = name.toString();
        if (description) newEvent.description = description.toString();
        if (link) newEvent.link = link.toString();

        newEvent.imageURL = imagePath
          ? `https://ipfs.io/ipfs/${
              event.params.eventDataCID
            }${imagePath.toString()}`
          : "https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png";
      }
    }

    newEvent.save();
  }
}

export function handleNewRSVP(event: NewRSVP): void {
  const id =
    event.params.eventId.toHex() + event.params.attendeeAddress.toHex();
  const attendeeAccount = getAttendeeAccount(event.params.attendeeAddress);
  const thisEvent = Event.load(event.params.eventId.toHex());

  let newRSVP = RSVP.load(id);

  if (!newRSVP && thisEvent) {
    newRSVP = new RSVP(id);
    newRSVP.attendee = attendeeAccount.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    thisEvent.totalRSVPs = integer.increment(thisEvent.totalRSVPs);
    thisEvent.save();
    attendeeAccount.totalRSVPs = integer.increment(attendeeAccount.totalRSVPs);
    attendeeAccount.save();
  }
}
