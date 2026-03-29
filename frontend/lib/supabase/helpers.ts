/**
 * Helpers para queries comunes de Supabase
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

/**
 * Ejecuta una query que debe retornar un único registro
 * @param queryBuilder - Query builder de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado con el dato o error
 */
export async function fetchOne<T>(
    queryBuilder: any,
    errorMessage: string = "Error al obtener registro"
): Promise<Result<T>> {
    try {
        const { data, error } = await queryBuilder.single();

        if (error) {
            logger.error(errorMessage, error);
            return failure(errorMessage, "FETCH_ONE_ERROR");
        }

        if (!data) {
            return failure("Registro no encontrado", "NOT_FOUND");
        }

        return success(data as T);
    } catch (error) {
        logger.error(`Unexpected error in fetchOne: ${errorMessage}`, error);
        return failure("Error inesperado", "FETCH_ONE_EXCEPTION");
    }
}

/**
 * Ejecuta una query que puede retornar un único registro o null
 * @param queryBuilder - Query builder de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado con el dato, null, o error
 */
export async function fetchMaybeOne<T>(
    queryBuilder: any,
    errorMessage: string = "Error al obtener registro"
): Promise<Result<T | null>> {
    try {
        const { data, error } = await queryBuilder.maybeSingle();

        if (error) {
            logger.error(errorMessage, error);
            return failure(errorMessage, "FETCH_MAYBE_ONE_ERROR");
        }

        return success(data as T | null);
    } catch (error) {
        logger.error(`Unexpected error in fetchMaybeOne: ${errorMessage}`, error);
        return failure("Error inesperado", "FETCH_MAYBE_ONE_EXCEPTION");
    }
}

/**
 * Ejecuta una query que retorna múltiples registros
 * @param queryBuilder - Query builder de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado con el array de datos o error
 */
export async function fetchMany<T>(
    queryBuilder: any,
    errorMessage: string = "Error al obtener registros"
): Promise<Result<T[]>> {
    try {
        const { data, error } = await queryBuilder;

        if (error) {
            logger.error(errorMessage, error);
            return failure(errorMessage, "FETCH_MANY_ERROR");
        }

        return success((data as T[]) || []);
    } catch (error) {
        logger.error(`Unexpected error in fetchMany: ${errorMessage}`, error);
        return failure("Error inesperado", "FETCH_MANY_EXCEPTION");
    }
}

/**
 * Ejecuta una inserción en Supabase
 * @param table - Nombre de la tabla
 * @param data - Datos a insertar
 * @param supabase - Cliente de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado con el registro insertado o error
 */
export async function insertOne<T>(
    table: string,
    data: any,
    supabase: SupabaseClient,
    errorMessage: string = "Error al insertar registro"
): Promise<Result<T>> {
    try {
        const { data: inserted, error } = await supabase
            .from(table)
            .insert(data)
            .select()
            .single();

        if (error) {
            logger.error(errorMessage, { table, error });
            return failure(errorMessage, "INSERT_ERROR");
        }

        return success(inserted as T);
    } catch (error) {
        logger.error(`Unexpected error in insertOne: ${errorMessage}`, error);
        return failure("Error inesperado", "INSERT_EXCEPTION");
    }
}

/**
 * Ejecuta una actualización en Supabase
 * @param table - Nombre de la tabla
 * @param id - ID del registro a actualizar
 * @param updates - Datos a actualizar
 * @param supabase - Cliente de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado de la operación
 */
export async function updateOne(
    table: string,
    id: string,
    updates: any,
    supabase: SupabaseClient,
    errorMessage: string = "Error al actualizar registro"
): Promise<Result<boolean>> {
    try {
        const { error } = await supabase
            .from(table)
            .update(updates)
            .eq("id", id);

        if (error) {
            logger.error(errorMessage, { table, id, error });
            return failure(errorMessage, "UPDATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error(`Unexpected error in updateOne: ${errorMessage}`, error);
        return failure("Error inesperado", "UPDATE_EXCEPTION");
    }
}

/**
 * Ejecuta una eliminación en Supabase
 * @param table - Nombre de la tabla
 * @param id - ID del registro a eliminar
 * @param supabase - Cliente de Supabase
 * @param errorMessage - Mensaje de error personalizado
 * @returns Resultado de la operación
 */
export async function deleteOne(
    table: string,
    id: string,
    supabase: SupabaseClient,
    errorMessage: string = "Error al eliminar registro"
): Promise<Result<boolean>> {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq("id", id);

        if (error) {
            logger.error(errorMessage, { table, id, error });
            return failure(errorMessage, "DELETE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error(`Unexpected error in deleteOne: ${errorMessage}`, error);
        return failure("Error inesperado", "DELETE_EXCEPTION");
    }
}
