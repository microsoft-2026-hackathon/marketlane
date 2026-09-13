import type { Customer } from "../../shared/contracts.js";
import type { Database } from "../db/database.js";
import { notFound } from "../domain/errors.js";

export function listCustomers(database: Database): Customer[] {
  return database.prepare<[], Customer>("SELECT id, name, email, company FROM customers ORDER BY name").all();
}

export function getCustomer(database: Database, id: string): Customer {
  const customer = database.prepare<[string], Customer>(
    "SELECT id, name, email, company FROM customers WHERE id = ?",
  ).get(id);
  if (!customer) notFound("Customer");
  return customer;
}
