import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateEMVCoPayload } from '@/lib/emvco';
import { getSettings } from '@/app/settings/actions';
import styles from './ReceiptPreview.module.css';

const ReceiptPreview = ({ cart, totals, includeTax, invoiceNumber, onClose, onPrint }) => {
    const [settings, setSettings] = useState(null);
    const invoiceNo = invoiceNumber || `FBR-${Math.floor(100000 + Math.random() * 900000)}`;
    const date = new Date().toLocaleString();

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const qrPayload = settings?.raast_id ? generateEMVCoPayload({
        raastId: settings.raast_id,
        amount: totals.total,
        merchantName: settings.merchant_name,
        merchantCity: settings.merchant_city,
        invoiceNo: invoiceNo
    }) : null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.receiptContainer}>
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.logo}>
                            <img src="/flames-by-the-indus-logo-for-receipt.svg" alt="Flames by the Indus" style={{ height: '60px', marginBottom: '0.5rem' }} />
                        </div>
                        <p>{settings?.merchant_name || 'Flames by the Indus'} - {settings?.merchant_city || 'Islamabad'}</p>
                        <p>NTN: 1234567-8 | STRN: 1234567890123</p>
                        {includeTax && (
                            <div className={styles.fbrHeader}>
                                <img src="/fbr-logo.png" alt="FBR" className={styles.fbrLogo} />
                                <span>FBR Invoice: {invoiceNo}</span>
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div className={styles.meta}>
                        <span>Date: {date}</span>
                        <span>User: Admin</span>
                    </div>

                    {/* Items */}
                    <div className={styles.items}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th className={styles.right}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.name}</td>
                                        <td>{item.qty}</td>
                                        <td className={styles.right}>{(item.price * item.qty).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className={styles.totals}>
                        <div className={styles.row}>
                            <span>Sub Total:</span>
                            <span>Rs. {totals.subtotal.toLocaleString()}</span>
                        </div>
                        {includeTax && (
                            <div className={styles.row}>
                                <span className="font-bold">GST (16%):</span>
                                <span>Rs. {totals.tax.toLocaleString()}</span>
                            </div>
                        )}
                        <div className={`${styles.row} ${styles.grandTotal}`}>
                            <span>Total:</span>
                            <span>Rs. {totals.total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Payment QR Code */}
                    {qrPayload && (
                        <div className={styles.qrSection}>
                            <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg my-4">
                                <QRCodeSVG
                                    value={qrPayload}
                                    size={150}
                                    level="M"
                                    includeMargin={true}
                                />
                                <div className="mt-2 text-center">
                                    <p className="font-bold text-sm text-gray-800">Scan to Pay with Raast / JazzCash</p>
                                    <p className="text-xs text-gray-500">Amount: Rs. {totals.total.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FBR QR Code - only show when tax is included */}
                    {includeTax && (
                        <div className={styles.qrSection}>
                            <img
                                src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=FBR-VERIFY-INVOICE"
                                alt="FBR QR Code"
                                className={styles.qrCode}
                            />
                            <p>Verify this invoice via FBR Tax Asaan App</p>
                        </div>
                    )}

                    <p className={styles.footer}>Thank you for dining with us!</p>
                </div>

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onClose}>Back</button>
                    <button className={styles.printBtn} onClick={onPrint}>Print & Close</button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptPreview;
