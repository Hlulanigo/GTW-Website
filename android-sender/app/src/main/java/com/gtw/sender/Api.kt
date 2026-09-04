package com.gtw.sender

import com.google.firebase.auth.FirebaseAuth
import okhttp3.Interceptor
import okhttp3.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

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
data class AuthSyncRequest(val name: String, val phone: String? = null)
data class CreateParcelRequest(val origin: String, val destination: String, val size: String, val compensation: Int, val pickupDate: String)

interface GtwApi {
    @POST("api/auth/sync") suspend fun syncProfile(@Body request: AuthSyncRequest): Map<String, Any?>
    @GET("api/parcels") suspend fun parcels(@Query("senderId") senderId: String? = null): List<ParcelSummary>
    @POST("api/parcels") suspend fun createParcel(@Body request: CreateParcelRequest): ParcelSummary
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
