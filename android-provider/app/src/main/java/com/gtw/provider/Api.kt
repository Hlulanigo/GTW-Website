package com.gtw.provider

import com.google.firebase.auth.FirebaseAuth
import okhttp3.Interceptor
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

class FirebaseTokenInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = FirebaseAuth.getInstance().currentUser?.getIdToken(false)?.result?.token
        val request = chain.request().newBuilder()
            .addHeader("Accept", "application/json")
            .apply { if (!token.isNullOrBlank()) addHeader("Authorization", "Bearer $token") }
            .build()
        return chain.proceed(request)
    }
}

data class ParcelSummary(val id: String, val origin: String, val destination: String, val status: String?, val compensation: Int?)
data class RouteSummary(val id: String, val origin: String, val destination: String, val status: String?, val availableCapacity: Int?)
data class AcceptParcelRequest(val transporterId: String)

interface GtwApi {
    @GET("api/parcels") suspend fun availableParcels(@Query("transporterId") transporterId: String? = null): List<ParcelSummary>
    @PATCH("api/parcels/{id}/accept") suspend fun acceptParcel(@Path("id") id: String, @Body request: AcceptParcelRequest): ParcelSummary
    @GET("api/routes") suspend fun routes(@Query("carrierId") carrierId: String? = null): List<RouteSummary>
    @POST("api/routes") suspend fun createRoute(@Body request: Map<String, Any?>): RouteSummary
    @GET("api/notifications/unread-count") suspend fun unreadNotifications(): Map<String, Int>
}

object ApiClient {
    val api: GtwApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okhttp3.OkHttpClient.Builder().addInterceptor(FirebaseTokenInterceptor()).build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(GtwApi::class.java)
    }
}
