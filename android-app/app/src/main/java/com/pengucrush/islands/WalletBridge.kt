package com.pengucrush.islands

import android.net.Uri
import android.util.Base64
import androidx.activity.ComponentActivity
import com.solana.mobilewalletadapter.clientlib.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.function.Consumer

/** Keys never enter the WebView. Signing is always approved in the installed wallet. */
class WalletBridge(activity: ComponentActivity, private val reply: Consumer<String>) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val sender = ActivityResultSender(activity)
    private val prefs = activity.getSharedPreferences("pengu_wallet", 0)
    private val adapter = MobileWalletAdapter(ConnectionIdentity(
        identityUri = Uri.parse("https://digitalchocolate.co"),
        iconUri = Uri.parse("assets/games/pengucrush-icon.png"),
        identityName = "PenguCrush"
    )).apply {
        blockchain = if (BuildConfig.SOLANA_CLUSTER == "devnet") Solana.Devnet else Solana.Mainnet
        authToken = prefs.getString("auth_token", null)
    }
    private var busy = false
    private fun encoded(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun respond(id: String, data: JSONObject? = null, error: String? = null, code: String? = null) {
        reply.accept(JSONObject().put("id", id).put("data", data).put("error", error).put("code", code).toString())
    }
    fun request(id: String, action: String, json: String) {
        if (id.length > 80 || json.length > 12000) return
        if (busy) { respond(id, error = "Finish the open wallet request first.", code = "BUSY"); return }
        busy = true
        scope.launch {
            try {
                val args = JSONObject(json)
                if (action == "disconnect") {
                    // Disconnect locally immediately, even if a wallet is no longer installed.
                    try { adapter.disconnect(sender) } finally {
                        adapter.authToken = null
                        prefs.edit().remove("auth_token").apply()
                    }
                    respond(id, JSONObject().put("disconnected", true))
                    return@launch
                }
                require(action in listOf("connect", "signMessage", "signAndSend")) { "Unknown wallet action" }
                val result = adapter.transact(sender) { authorization ->
                    val account = authorization.accounts.first()
                    if (action != "connect") require(encoded(account.publicKey) == args.getString("walletBase64")) { "Your wallet account changed. Disconnect and reconnect to continue." }
                    when (action) {
                        "connect" -> JSONObject().put("walletBase64", encoded(account.publicKey)).put("label", account.accountLabel ?: "Wallet")
                        "signMessage" -> {
                            val message = args.getString("message")
                            require(message.startsWith("digitalchocolate.co wants you to sign in to PenguCrush:"))
                            val signed = signMessagesDetached(arrayOf(message.toByteArray(Charsets.UTF_8)), arrayOf(account.publicKey))
                            JSONObject().put("signatureBase64", encoded(signed.messages.first().signatures.first()))
                        }
                        else -> {
                            val transaction = Base64.decode(args.getString("transaction"), Base64.DEFAULT)
                            require(transaction.size <= 1232)
                            val signed = signAndSendTransactions(arrayOf(transaction))
                            JSONObject().put("signatureBase64", encoded(signed.signatures.first()))
                        }
                    }
                }
                when (result) {
                    is TransactionResult.Success -> {
                        prefs.edit().putString("auth_token", adapter.authToken).apply()
                        respond(id, result.successPayload)
                    }
                    is TransactionResult.NoWalletFound -> respond(id, error = "No compatible wallet was found. Set up Seed Vault Wallet on your Seeker, then try again.", code = "NO_WALLET")
                    is TransactionResult.Failure -> respond(id, error = "The wallet did not complete the request. If you approved a payment, check its status before retrying.", code = "WALLET_INCOMPLETE")
                }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { respond(id, error = error.message ?: "Wallet request interrupted. Check payment status before retrying.", code = "WALLET_INCOMPLETE") }
            finally { busy = false }
        }
    }
    fun close() { scope.cancel() }
}
