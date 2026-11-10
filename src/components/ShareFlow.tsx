"use client";

import { useState } from "react";
import { PostChecker } from "./PostChecker";
import { SetPriceForm } from "./SetPriceForm";

/** Sharers must pass the AI scam review before they can set a price (and so before anyone can pay them). */
export function ShareFlow() {
  const [approved, setApproved] = useState(false);
  return (
    <>
      <PostChecker onApproved={setApproved} />
      <SetPriceForm approved={approved} />
    </>
  );
}
