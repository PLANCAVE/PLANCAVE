"use client";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../context/AppContext";
import Image from "next/image";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import axios from "axios";

const Checkout = () => {
  const { user } = useUser();
  const { cart } = useContext(AppContext);
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1 for order summary, 2 for payment details
  
  // M-Pesa specific states
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState(""); // "pending", "success", "failed"
  const [_checkoutRequestID, setCheckoutRequestID] = useState("");

  useEffect(() => {
    if (router.query.cart) {
      try {
        const decodedCart = JSON.parse(decodeURIComponent(router.query.cart));
        setSelectedProduct(decodedCart);
      } catch (error) {
        console.error("Error decoding cart:", error);
      }
    }
  }, [router.query]);

  const itemsToDisplay = selectedProduct ? [...selectedProduct] : cart || [];

  const totalPrice = itemsToDisplay.reduce(
    (sum, product) => sum + (product.adjustedPrice || product.price || 0) * (product.quantity || 1),
    0
  );

  const formatPhoneNumber = (phone) => {
    try {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('0') && cleaned.length === 10) {
        return `254${cleaned.slice(1)}`;
      }
      if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) {
        return `254${cleaned}`;
      }
      if (cleaned.startsWith('254') && cleaned.length === 12) {
        return cleaned;
      }
      return null;
    } catch (error) {
      console.error('[M-Pesa] Phone formatting error:', error);
      return null;
    }
  };

  const handleSuccess = (details) => {
    console.log('[Payment] Success:', details);
    setIsProcessing(false);
    setTimeout(() => {
      router.push('/success');
    }, 3000);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    console.log('[Payment] Submission started');

    if (!paymentMethod) {
      showNotification("Please select a payment method");
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === "Mpesa") {
        handleMpesaSubmit();
      } else if (paymentMethod === "PayPal") {
        // PayPal is handled by the PayPal buttons component
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('[Payment] Error:', error);
      setIsProcessing(false);
      showNotification("Payment processing failed. Please try again.");
    }
  };

  
  const handleMpesaSubmit = async () => {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      setIsProcessing(false);
      showNotification("Please enter a valid phone number");
      return;
    }
  
    try {
      setMpesaStatus("pending");
      setIsMpesaModalOpen(true);
      
      // Define the amount from totalPrice
      const amount = Math.round(totalPrice); // M-Pesa typically requires whole numbers
      
      // Log the request payload for debugging
      console.log('[M-Pesa] Request payload:', {
        phoneNumber: formattedPhone,
        amount: amount
      });
      
      const response = await axios.post("/api/mpesa/stkPush", {
        phoneNumber: formattedPhone,
        amount: amount
      });
      
      console.log('[M-Pesa] STK Push initiated:', response.data);
      
      if (response.data && response.data.CheckoutRequestID) {
        setCheckoutRequestID(response.data.CheckoutRequestID);
        // Start polling for payment status
        pollMpesaPaymentStatus(response.data.CheckoutRequestID);
      } else {
        throw new Error("Invalid response from STK Push API");
      }
    } catch (error) {
      console.error('[M-Pesa] Error:', error);
      
      // Enhanced error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('[M-Pesa] Server response error:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // The request was made but no response was received
        console.error('[M-Pesa] No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('[M-Pesa] Request setup error:', error.message);
      }
      
      setMpesaStatus("failed");
      setTimeout(() => {
        setIsMpesaModalOpen(false);
        setIsProcessing(false);
      }, 3000);
      showNotification("M-Pesa payment initiation failed. Please try again.");
    }
  };


  const pollMpesaPaymentStatus = async (requestId) => {
    try {
      // Poll every 5 seconds for up to 2 minutes (24 attempts)
      let attempts = 0;
      const maxAttempts = 24;
      const pollInterval = 5000;

      const checkStatus = async () => {
        if (attempts >= maxAttempts) {
          setMpesaStatus("failed");
          setTimeout(() => {
            setIsMpesaModalOpen(false);
            setIsProcessing(false);
          }, 3000);
          showNotification("Payment verification timed out. Please check your M-Pesa and try again if needed.");
          return;
        }

        attempts++;
        
        try {
          const statusResponse = await axios.get(`/api/checkMpesaStatus?checkoutRequestId=${requestId}`);
          
          if (statusResponse.data.status === "success") {
            setMpesaStatus("success");
            setTimeout(() => {
              handleSuccess({
                paymentMethod: "M-Pesa",
                transactionId: statusResponse.data.transactionId || requestId
              });
              setIsMpesaModalOpen(false);
            }, 3000);
            return;
          } else if (statusResponse.data.status === "failed") {
            setMpesaStatus("failed");
            setTimeout(() => {
              setIsMpesaModalOpen(false);
              setIsProcessing(false);
            }, 3000);
            showNotification("M-Pesa payment failed. Please try again.");
            return;
          }
          
          // If still pending, continue polling
          setTimeout(checkStatus, pollInterval);
        } catch (error) {
          console.error('[M-Pesa] Status check error:', error);
          // Continue polling despite error
          setTimeout(checkStatus, pollInterval);
        }
      };

      // Start the polling
      setTimeout(checkStatus, pollInterval);
    } catch (error) {
      console.error('[M-Pesa] Polling error:', error);
      setMpesaStatus("failed");
      setTimeout(() => {
        setIsMpesaModalOpen(false);
        setIsProcessing(false);
      }, 3000);
    }
  };

  const showNotification = (message) => {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.classList.remove("hidden");
    
    setTimeout(() => {
      notification.classList.add("hidden");
    }, 3000);
  };

  const nextStep = () => {
    setStep(2);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const prevStep = () => {
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Progress bar */}
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-center">
          <div className="flex items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'} z-10`}>
              1
            </div>
            <div className="text-sm absolute -bottom-6 w-20 text-center">Cart</div>
          </div>
          <div className={`h-1 w-20 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <div className="flex items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'} z-10`}>
              2
            </div>
            <div className="text-sm absolute -bottom-6 w-20 text-center">Payment</div>
          </div>
          <div className={`h-1 w-20 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <div className="flex items-center relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'} z-10`}>
              3
            </div>
            <div className="text-sm absolute -bottom-6 w-20 text-center">Complete</div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {/* Checkout Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <h1 className="text-2xl font-bold">Checkout</h1>
            <p className="opacity-80">Complete your purchase securely</p>
          </div>

          <div className="p-6">
            {step === 1 ? (
              /* Order Summary */
              <div>
                <h2 className="text-xl font-semibold mb-6">Order Summary</h2>

                {itemsToDisplay.length === 0 ? (
                  <div className="py-8 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <p className="mt-4 text-gray-600">Your cart is empty.</p>
                    <button
                      onClick={() => router.push('/all-products')}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-4">
                      {itemsToDisplay.map((product) => (
                        <motion.div
                          key={product._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="flex p-4 border border-gray-100 rounded-xl hover:shadow-md transition"
                        >
                          <div className="rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            
                            {product.image && (
                              <Image
                                src={product.image}
                                alt={product.name}
                                width={100}
                                height={100}
                                className="object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <div className="ml-6 flex-1">
                            <div className="flex justify-between">
                              <h3 className="text-lg font-medium">{product.name}</h3>
                              <p className="font-medium">
                                ${(product.adjustedPrice * product.quantity).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">ID: {product._id}</p>
                            <div className="flex justify-between items-end mt-2">
                              <div>
                                <p className="text-sm text-gray-600">
                                  ${product.adjustedPrice} × {product.quantity}
                                </p>
                                {product.selectedFileType && product.selectedFileType !== "None" && (
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded mt-2">
                                    {product.selectedFileType}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  // Remove item functionality would go here
                                }}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 mt-6 pt-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span>${totalPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span>$0.00</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg pt-2 border-t">
                        <span>Total</span>
                        <span className="text-blue-700">${totalPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-between">
                      <button
                        onClick={() => router.push('/all-products')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Continue Shopping
                      </button>
                      <button
                        onClick={nextStep}
                        className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
                      >
                        Proceed to Payment
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Billing & Payment */
              <div>
                <div className="flex items-center mb-6">
                  <button
                    onClick={prevStep}
                    className="mr-4 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold">Payment Details</h2>
                </div>

                <form onSubmit={handlePaymentSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="John Doe"
                          defaultValue={user?.fullName || ""}
                          required
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Email Address</label>
                        <input
                          type="email"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="johndoe@example.com"
                          defaultValue={user?.primaryEmailAddress?.emailAddress || ""}
                          required
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                          type="tel"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                          placeholder="254 700 000 000"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">Format: 254XXXXXXXXX or 07XXXXXXXX</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Select Payment Method</h3>
                      <div className="space-y-3">
                        {["PayPal", "Mpesa"].map((method) => (
                          <label 
                            key={method} 
                            className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${
                              paymentMethod === method ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method}
                              checked={paymentMethod === method}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="form-radio text-blue-600 h-5 w-5"
                            />
                            <div className="ml-3 flex items-center">
                              {method === "Mpesa" && (
                                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center mr-2">
                                  <span className="text-white font-bold text-xs">M</span>
                                </div>
                              )}
                              {method === "PayPal" && (
                                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mr-2">
                                  <span className="text-white font-bold text-xs">P</span>
                                </div>
                              )}
                              <span>{method}</span>
                            </div>
                          </label>
                        ))}
                      </div>

                      {paymentMethod === "PayPal" && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <PayPalScriptProvider options={{ "client-id": "AStLW3cCz5LLbNIAuCuhPqD0xpFTwac7iXvqv6PJCZhAZwJ_L6bMfIGWW4lMThDttWN-WYTOvHddn9cp" }}>
                            <PayPalButtons
                              style={{ layout: "vertical" }}
                              createOrder={(_data, actions) => {
                                return actions.order.create({
                                  purchase_units: [{ amount: { value: totalPrice.toFixed(2) } }],
                                });
                              }}
                              onApprove={async (_data, actions) => {
                                const details = await actions.order.capture();
                                handleSuccess(details);
                              }}
                            />
                          </PayPalScriptProvider>
                        </div>
                      )}

                      {paymentMethod === "Mpesa" && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100">
                          <div className="flex items-center mb-3">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h4 className="font-medium">M-Pesa Payment</h4>
                              <p className="text-sm text-gray-600">You'll receive a prompt on your phone</p>
                            </div>
                          </div>
                          <p className="text-sm mb-2">Amount: <span className="font-medium">${totalPrice.toLocaleString()}</span></p>
                          <p className="text-sm text-gray-600">Make sure your phone is available to complete the transaction.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <div className="flex justify-between mb-4">
                      <span className="font-medium">Total Amount:</span>
                      <span className="text-xl font-semibold text-blue-700">${totalPrice.toLocaleString()}</span>
                    </div>

                    <button
                      type="submit"
                      className={`w-full ${isProcessing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white p-4 rounded-lg text-lg font-medium transition flex items-center justify-center`}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          Complete Purchase
                          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* M-Pesa Payment Modal */}
      {isMpesaModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
          >
            <div className="text-center">
              {mpesaStatus === "pending" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">M-Pesa Payment Initiated</h3>
                  <p className="mb-4">Please check your phone for the M-Pesa prompt and enter your PIN to complete the payment.</p>
                  <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800 mb-4">
                    <p>Amount: <span className="font-bold">${totalPrice.toLocaleString()}</span></p>
                    <p>Phone: <span className="font-bold">{formatPhoneNumber(phoneNumber)}</span></p>
                  </div>
                  <p className="text-gray-500 text-sm">This window will automatically update once your payment is confirmed.</p>
                </>
              )}

              {mpesaStatus === "success" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Payment Successful!</h3>
                  <p className="mb-4">Your M-Pesa payment has been confirmed. Thank you for your purchase!</p>
                  <p className="text-gray-500 text-sm">You will be redirected to the success page shortly...</p>
                </>
              )}

              {mpesaStatus === "failed" && (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Payment Failed</h3>
                  <p className="mb-4">We couldn't confirm your M-Pesa payment. Please try again.</p>
                  <button
                    onClick={() => setIsMpesaModalOpen(false)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Notification */}
      <div id="notification" className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg hidden transform transition-transform duration-300">
        Please select a payment method.
      </div>
    </div>
  );
};

export default Checkout;