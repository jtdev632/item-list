import {Component, inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Item} from '../item/Item';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ItemComponent} from '../item/item.component';
import {ImageComponent} from '../image/image.component';
import {NgClass, NgForOf, NgIf} from '@angular/common';
import {amountValuesValidator} from '../../validators/amount-values.validator';
import {animate, style, transition, trigger} from '@angular/animations';
import {Router, RouterModule} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {StorageService} from '../../services/storage.service';
import {AmountOperations} from '../../services/AmountOperations';
import {Subscription} from 'rxjs';
import {NavbarComponent} from '../navbar/navbar.component';


@Component({
  selector: 'app-form-item',
  templateUrl: './form-item.component.html',
  styleUrl: './form-item.component.scss',
  standalone: true,
  imports: [
    ItemComponent,
    ImageComponent,
    ReactiveFormsModule,
    NgIf,
    NgForOf,
    RouterModule,
    NavbarComponent,
    NgClass
  ],
  animations: [
    trigger('itemAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('400ms', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class FormItemComponent implements OnInit, OnDestroy {
  @ViewChild(ImageComponent) imageComponent!: ImageComponent;
  @ViewChild(ItemComponent) itemComponent!: ItemComponent;

  authService : AuthService  = inject(AuthService)

  itemForm: FormGroup;
  formData!: Item;
  errorMessage: string = '';
  items: Item[] = [];
  isFormVisible: boolean = false;
  private subscription: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private storageService:StorageService,
    private route: Router
  ) {
    this.itemForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      amount: [null, [Validators.required, Validators.min(1)]],
      minValue: [null, [Validators.required, Validators.min(1)]],
      midValue: [null, [Validators.required, Validators.min(1)]],
      id: [''],
      img:[null]
    }, {
      validators: amountValuesValidator
    });
  }

  async ngOnInit() {
    this.authService.user$.subscribe((user)=>{
      if(user){
        this.authService.currentUserSig.set({
            email: user.email!,
            username: user.displayName!,
            id:user.uid
          }
        );

        const userId = this.authService.currentUserSig()?.id;
        this.storageService.setupItemsListener(userId);


        this.subscription = this.storageService.itemUpdates.subscribe(async update => {
          if (!update) {
            this.items = [];
            return;
          }
          if (Object.keys(update.items).length === 0 && this.items.length != 0) {
            const animation = async ():Promise<void> => {
              return new Promise((resolve)=>{
                this.itemComponent.isRemoving = true;
                setTimeout(()=>{
                  resolve();
                }, 350)
              })
            }
            await animation().then(()=>{
                this.items = [];
            });
            return;
          }


          if (update.type === 'full') {
            this.items = Object.entries(update.items).map(([id, obj]) => ({
              id,
              ...obj
            }));
          } else if (update.type === 'added') {
            const newItems = Object.entries(update.items).map(([id, obj]) => ({
              id,
              ...obj
            }));

            this.items = [...this.items, ...newItems];
          }
        });

      } else {
        this.route.navigateByUrl('/login');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  toggleForm(): void {
    const formEl = document.querySelector('.form');

    if (this.isFormVisible) {

      formEl?.classList.add('form-exit-animation');
      setTimeout(() => {
        this.isFormVisible = false;
        formEl?.classList.remove('form-exit-animation');
      }, 400);
    } else {

      this.isFormVisible = true;
      setTimeout(() => {
        formEl?.classList.add('form-enter-animation');
        setTimeout(() => {
          formEl?.classList.remove('form-enter-animation');
        }, 400);
      }, 10);
    }
  }

  async onSubmit() {
    if (this.itemForm.valid) {
      const newItem: Item = {
        ...this.itemForm.value,
        id: Math.floor(Math.random() * 1000).toString(),
        color: "border-green"
      };

      if (this.itemForm.get('img')?.value) {
        newItem.img = this.itemForm.get('img')?.value;
      }

      if(this.authService.currentUserSig()?.id){
        await this.storageService.addItem(this.authService.currentUserSig()?.id,newItem.id,newItem);
      }

      this.formData = newItem;
      this.itemForm.reset();
      this.imageComponent.resetImage();
    } else {
      if (this.itemForm.errors?.['invalidNumbers']) {
        this.errorMessage = 'Invalid input. Please enter positive numbers for Amount and values.';
      } else if (this.itemForm.errors?.['invalidRange']) {
        this.errorMessage = 'Invalid input. Please enter valid Amount and values.';
      }
    }
  }

  async onEventRemove(event: {value: string}): Promise<void> {
    this.items = this.items.filter(item => item.id !== event.value);
    await this.storageService.removeItem(this.authService.currentUserSig()?.id,event.value);
  }

  async onNewValuesEvent(event: { id: string; item: Item; action: AmountOperations }):Promise<void> {
    const item: Item | undefined = this.items.find(item => item.id === event.id);

    if(item){
      switch (event.action){
        case AmountOperations.SET_CURRENT_AMOUNT: {
          await this.storageService.changeAmount(this.authService.currentUserSig()?.id, event.id, item.amount,item.color);
          break;
        }
        case AmountOperations.SET_MID_MIN:{
          await this.storageService.changeMidMin(this.authService.currentUserSig()?.id, event.id,item.minValue,item.midValue,item.color);
        }
      }
    }
  }


  toggleBackground(event: { id: string }): void {
    const item:Item | undefined = this.items.find(item => item.id === event.id);
    if (!item) return;

    const {amount, midValue, minValue} = item;
    item.color = amount > midValue
      ? 'border-green'
      : amount > minValue
        ? 'border-yellow'
        : 'border-red';
  }
}
