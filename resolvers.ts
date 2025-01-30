import { ObjectId, Collection} from "mongodb";
import { ContactoModel, APIPhone, APIWorldtime } from "./types.ts";
import {GraphQLError } from "graphql";


//Contexto
type Context = {
    ContactoCollection: Collection <ContactoModel>
}

//Query args 
type getContactArgs = {
    id: string
}

//Mutation args
type addContactArgs = {
    name: string, 
    phone: string
}

type deleteContactArgs = {
    id: string
}

type updateContactArgs = {
    id: string, 
    name: string, 
    phone: string
}

export const resolvers = {
    Query: {
        getContacts: async (_parent: unknown, _args: unknown, ctx: Context): Promise<ContactoModel[]> => {
            return await ctx.ContactoCollection.find().toArray();
        },
        getContact: async (_parent: unknown, args: getContactArgs, ctx: Context): Promise <ContactoModel> => {
            //Comprobamos que exista ese contacto 
            const contactExiste =  await ctx.ContactoCollection.findOne({_id: new ObjectId(args.id)});
            if(!contactExiste){
                throw new GraphQLError("Contact not in DB");
            }
            return contactExiste;
        }
    },
    Mutation: {
        addContact: async (_parent: unknown, args: addContactArgs, ctx: Context): Promise <ContactoModel> => {
            //Comprobamos que tenemos la API_KEY añadida
            const API_KEY = Deno.env.get("API_KEY");
            if(!API_KEY){
                throw new GraphQLError("APIKEY needed");
            }
            //Obtenemos los argumentos como haciamos en APIREST
            const {name, phone} = args;

            //Comprobamos si existe el telefono 
            const phoneExiste = await ctx.ContactoCollection.findOne({phone: phone});
            if(phoneExiste){
                throw new GraphQLError(" Phone is already associated to someone");
            }

            //Aqui ya definimos la url de api key. 
            //Esta url es unica y la saco de la pagina de API NINJA. Para obtenerla, tenemos que entrar en la API que queremos usar y a la derecha sale la URL de esa API
            //En este caso vamos a usar la API de validate Phone
            //Al final le tenemos que añadir: "+ (el parametro que queremos usar dentro de esa API)", en este caso usamos telefono
            const url = 'https://api.api-ninjas.com/v1/validatephone?number=' + phone
            //Declaramos una nueva constante donde se va a guardar lo que buscamos 
            //Esto tiene que ser el parametro que nos indica la API, en este caso si vemos la API nos dice que le headers es obligatorio y nos indica como es 
            //Lo que va entre comillas (X-Api-Key), es el headers que lo hemos sacado de la API y lo comparamos con (API_KEY), que es para comprobar que este en la API_KEY
            const datos = await fetch(url, {
                headers: {
                    "X-Api-Key": API_KEY
                }
            })
            //Con esto comprobamos que la API este bien conectada, 
            //Lo que dice es que si el estatos de datos, es diferente de 200 (codigo de que esta todo bien),  lance un error 
            if(datos.status !== 200){
                throw new GraphQLError("Ninja API Error");
            }

            const respuesta: APIPhone = await datos.json();

            if(!respuesta.is_valid){
                throw new GraphQLError("Phone number is not valid");
            }

            const country = respuesta.conuntry;
            const timezone = respuesta.timezones[0]; //Esto es un array, por eso ponemos los corchetes y 0, para que nos coja solo el primer elemento del array

            const {insertedId} = await ctx.ContactoCollection.insertOne({
                name, 
                phone,
                country,
                timezone
            });
            return {
                _id: insertedId,
                name, 
                phone,
                country, 
                timezone
            }

        },
        updateContact: async (_parent: unknown, args: updateContactArgs, ctx: Context): Promise <ContactoModel> => {
            //Tenemos que acceder otra vez a la API para poder actualizar los datos 
            const API_KEY = Deno.env.get("API_KEY");
            if(!API_KEY){
                throw new GraphQLError("API_KEY needed");
            }

            //Declaramos los atributos que vamos a necesitar como en API REST
            const {id, name, phone} = args;

            if(!name && !phone){
                throw new GraphQLError("At least one parameter is compulsory");
            }

            //Si no tenemos el telefono nos metemos en esta zona
            if(!phone){
                const usuarioActualizado = await ctx.ContactoCollection.findOneAndUpdate({_id: new ObjectId(id)}, {$set: {name}});

                if(!usuarioActualizado){
                    throw new GraphQLError("No user found");
                }

                return usuarioActualizado;
            }

            //Si tenemos un telefono, se hace lo de arriba y lo de a continuación
            //Comprobamos que el telefono no esta asociado a otra persona 
            const telefonoAunasiExiste = await ctx.ContactoCollection.findOne({phone: phone});
            if(!telefonoAunasiExiste){
                throw new GraphQLError("Phone already associated to someone");
            }

            //Comprobamos que el telefono sea válido a traves de la API 
            const url = 'https://api.api-ninjas.com/v1/validatephone?number=' + phone;
            const datos = await fetch(url, {
                headers: {
                    "X-Api-Key": API_KEY
                }
            })

            if(datos.status !== 200) {
                throw new GraphQLError("Ninja API error");
            }

            const respuesta: APIPhone = await datos.json();
            if(!respuesta.is_valid){
                throw new GraphQLError("Phone number is not valid");
            }
            const country = respuesta.conuntry;
            const timezone =  respuesta.timezones[0];

            //Actualizamos los datos del telefono y los que estan asociados a él, que son country y timezone
            const actualizarUsuario = await ctx.ContactoCollection.findOneAndUpdate({_id: new Object(id)}, {$set: {
                name, 
                phone,
                country,
                timezone
            }})

            if(!actualizarUsuario){
                throw new GraphQLError("Unable to update user");
            }
            return actualizarUsuario;
        }, 

        deleteContact: async (_parent: undefined, args: deleteContactArgs, ctx: Context): Promise <boolean> => {
        const borrarUsuaro = await ctx.ContactoCollection.deleteOne({_id: new ObjectId(args.id)});

        if(borrarUsuaro.deletedCount === 1){
            return true;
        }
        else{
            return false;
        }}
    },

    //ENCADENADOS -> Se llamaran siempre que llamemos a un contacto en getContacts/getContact
    Contacto: {

        id: (parent: ContactoModel): string => {
            return parent._id!.toString();
        },

        datetime: async (parent: ContactoModel): Promise <string> => {
            const API_KEY = Deno.env.get("API_KEY");
            if(!API_KEY){
                throw new GraphQLError("API_KEY needed");
            }

            //PRIMERO OBTENEMOS EL TELEFONO PARA PODER SACAR EL TIMEZONE
            const urlTel = "https://api.api-ninjas.com/v1/validatephone?number=" + parent.phone
            const datos1 = await fetch(urlTel, {
                headers: {
                    "X-Api-Key": API_KEY
                }
            })
            if(datos1.status !== 200) {
                throw new GraphQLError("Ninja API Error Phone");
            }
                const responsePhone: APIPhone = await  datos1.json();

                const timezone = responsePhone.timezones[0];

                //TENIENDO LA TIMEZONE NOS PODEMOS IR A LA OTRA API PARA SACAR LA HORA
                const urlTime = "https://api.api-ninjas.com/v1/worldtime?timezone=" + timezone;
                const datos2 = await fetch(urlTime, {
                    headers: {
                        "X-Api-Key": API_KEY
                    }
                })

                if(datos2.status !== 200){
                    throw new GraphQLError ("Ninja API Error datetime");
                }

                const responseTime: APIWorldtime = await datos2.json();

                return responseTime.datetime; //Devolvemos la hora
            },
        
        country: async (parent: ContactoModel): Promise <string> =>{
                const API_KEY = Deno.env.get("API_KEY");
                if(!API_KEY){
                    throw new GraphQLError("APIKEY needed");
                }
                const url = "https://api.api-ninjas.com/v1/validatephone?number=" + parent.phone;
                const datos = await fetch(url, {
                    headers: {
                        "X-Api-Key": API_KEY
                    }
                })

                if(datos.status !== 200){
                    throw new GraphQLError("Ninja API Error country");
                }

                const response: APIPhone = await datos.json();

                return response.conuntry;
        },
        
        timezone: async (parent: ContactoModel): Promise<string> => {
            const API_KEY = Deno.env.get("API_KEY");
            if(!API_KEY){
                throw new GraphQLError("APIKEY needed");
            }
            const url = "https://api.api-ninjas.com/v1/validatephone?number=" + parent.phone;
            const datos = await fetch(url, {
                headers: {
                    "X-Api-Key": API_KEY
                }
            })
            if(datos.status !== 200){
                throw new GraphQLError("Ninja API Error timezone");
            }

            const response: APIPhone = await datos.json();

            return response.timezones[0];
        }
    }
}
    

