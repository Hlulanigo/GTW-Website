package com.gtw.provider

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ProviderApp() }
    }
}

@Composable
fun ProviderApp() {
    MaterialTheme {
        var signedIn by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser != null) }
        if (!signedIn) {
            Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("GTW Provider", style = MaterialTheme.typography.headlineMedium)
                Text("Carry parcels along routes you already travel.")
                Button(onClick = { signedIn = true }, modifier = Modifier.fillMaxWidth()) { Text("Continue with Firebase") }
                Text("Connect your Firebase sign-in screen here before release.", style = MaterialTheme.typography.bodySmall)
            }
        } else {
            ProviderHome(onSignOut = { FirebaseAuth.getInstance().signOut(); signedIn = false })
        }
    }
}

@Composable
private fun ProviderHome(onSignOut: () -> Unit) {
    var parcels by remember { mutableStateOf<List<ParcelSummary>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val uid = FirebaseAuth.getInstance().currentUser?.uid
    LaunchedEffect(Unit) {
        runCatching { ApiClient.api.availableParcels() }
            .onSuccess { parcels = it.filter { parcel -> parcel.status == "Paid" || parcel.status == "Pending" } }
            .onFailure { error = it.message ?: "Unable to load delivery jobs" }
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Provider") }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { }) { Text("My routes") }
                OutlinedButton(onClick = onSignOut) { Text("Sign out") }
            }
            Text("Available delivery jobs", style = MaterialTheme.typography.titleLarge)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(parcels) { parcel ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("${parcel.origin} to ${parcel.destination}", style = MaterialTheme.typography.titleMedium)
                            Text("${parcel.status ?: "Pending"}  |  Earn R${parcel.compensation ?: 0}")
                            Button(onClick = { if (uid != null) { /* connect to accept mutation */ } }) { Text("View job") }
                        }
                    }
                }
            }
        }
    }
}
