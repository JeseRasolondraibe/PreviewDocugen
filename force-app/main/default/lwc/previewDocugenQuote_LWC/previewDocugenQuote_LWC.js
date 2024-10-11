import { LightningElement, api, wire, track } from 'lwc';
import { loadStyle } from "lightning/platformResourceLoader";
import LoadPreviewDocumentQuote from '@salesforce/apex/PreviewDocugenDocumentQuote.LoadPreviewDocumentQuote';
import { subscribe } from 'lightning/empApi';
import getLastFile from '@salesforce/apex/FilePreviewAndDownloadController.getLastFile';
import getQuoteFields from '@salesforce/apex/PreviewDocugenDocumentQuote.getQuoteFields';
import modal from "@salesforce/resourceUrl/custommodalcss";
import { refreshApex } from '@salesforce/apex';
import updateDocugenPreviewed from '@salesforce/apex/PreviewDocugenDocumentQuote.updateDocugenPreviewed';

export default class DocugenPreviewScreenAction extends LightningElement {
    @api recordId;
    @api channelName = '/event/QuoteDocumentCreated__e';

    error;
    isReadyToPreview = false;
    loading = false;
    subscription = {};

    @track filesList = [];
    @track quote;

    // Variables pour stocker les résultats des appels Apex
    wiredQuoteResult;
    wiredFileResult;

    // Obtenir les données de la quote
    @wire(getQuoteFields, { quoteId: '$recordId' })
    wiredQuote(result) {
        this.wiredQuoteResult = result;
        if (result.data) {
            this.quote = result.data;

            // Vérification si DocugenHasBeenPreviewed__c est true
            if (this.quote.DocugenHasBeenPreviewed__c) {
                // Attendre 5 secondes avant de mettre isReadyToPreview à true
                setTimeout(() => {
                    this.loading = false;
                    this.isReadyToPreview = true;
                    console.log('isReadyToPreview passé à true après 5 secondes');
                }, 5000);
            }
        } else if (result.error) {
            console.error(result.error);
        }
    }

    // Lancer le preview du document
    launchPreview(event) {
        this.loading = true;
        const elementId = event.target.dataset.id;
        console.log('ID : ' + elementId);
        LoadPreviewDocumentQuote({ recordId: event.target.dataset.id })
            .then(result => {
                console.log('Preview lancé');
            })
            .catch(error => {
                console.error('Erreur lors du chargement :' + error);
            });
    }

    // Lors du montage du composant
    connectedCallback() {
        loadStyle(this, modal);
        this.handleSubscribe();
    }

    // Abonnement à l'événement Platform Event
    handleSubscribe() {
        const messageCallback = (response) => {
            console.log('Nouveau message reçu:', JSON.stringify(response));
            const quoteIdValue = response.data.payload.QuoteId__c;

            // Exécuter la méthode updateDocugenPreviewed pour mettre à jour le champ
            this.handleQuoteDocumentCreated(quoteIdValue);
        };

        subscribe(this.channelName, -1, messageCallback).then(response => {
            console.log('Abonnement à : ', JSON.stringify(response.channel));
            this.subscription = response;
        });
    }

    // Cette méthode sera appelée à chaque réception de l'événement
    handleQuoteDocumentCreated(quoteId) {
        console.log('Traitement de l\'événement pour le Quote ID:', quoteId);

        updateDocugenPreviewed({ quoteId: quoteId })
            .then(() => {
                console.log('Quote mis à jour avec succès');
                // Rafraîchir la liste des fichiers et les données du quote
                return Promise.all([
                    refreshApex(this.wiredQuoteResult),
                    refreshApex(this.wiredFileResult)
                ]);
            })
            .catch(error => {
                console.error('Erreur lors de la mise à jour du quote:', error);
            });
    }

    // Obtenir les fichiers
    @wire(getLastFile, { recordId: '$recordId' })
    wiredResult(result) {
        this.wiredFileResult = result;
        const { data, error } = this.wiredFileResult;
        if (data) {
            this.filesList = Object.keys(data).map(item => ({
                "label": data[item],
                "value": item,
                "url": `/sfc/servlet.shepherd/document/download/${item}`
            }));
        }
        if (error) {
            console.error(error);
        }
    }
}