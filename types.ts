import { OptionalId } from "mongodb";

export type ContactoModel = OptionalId <{
    name: string, 
    phone: string, 
    country: string, 
    timezone: string
}>;

export type APIPhone = {
    is_valid: boolean,
    conuntry: string, 
    timezones: [string]
};

export type APIWorldtime = {
    datetime: string
}